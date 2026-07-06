import { useCallback, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from '@/lib/alert';
import { database } from '@/db';
import type ImageRecord from '@/db/models/ImageRecord';
import { imagesForSet, createImage, softDeleteImage, type ImageKind } from '@/repositories/images';
import { captureFromCamera, pickFromGallery } from '@/lib/images';
import { useImageSrc } from '@/lib/imageSrc';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import PlusIcon from '@/assets/icons/plus.svg';

/**
 * Photos for a set (spec §8): camera/gallery capture, local thumbnails, remove. The file
 * is copied to app storage and an `images` row is written immediately so the thumbnail
 * shows with no network. Upload happens later via the Phase-4 queue.
 */
export function SetImages({ setId }: { setId: string }) {
  const [images, setImages] = useState<ImageRecord[]>([]);

  const load = useCallback(async () => {
    setImages(await imagesForSet(database, setId));
  }, [setId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const add = useCallback(
    async (kind: Extract<ImageKind, 'camera' | 'gallery'>) => {
      const picked = kind === 'camera' ? await captureFromCamera() : await pickFromGallery();
      if (!picked) return;
      await createImage(database, setId, {
        kind,
        localUri: picked.localUri,
        width: picked.width,
        height: picked.height,
      });
      load();
    },
    [setId, load],
  );

  // Web source-choice sheet: RN's Alert action sheet is a no-op on react-native-web, so the
  // camera/gallery choice is shown as a small modal there instead (native keeps the Alert).
  const [sourceMenu, setSourceMenu] = useState(false);

  const onAdd = useCallback(() => {
    if (Platform.OS === 'web') {
      setSourceMenu(true);
      return;
    }
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => add('camera') },
      { text: 'Choose from gallery', onPress: () => add('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [add]);

  // Called straight from the source-menu tap so the file-picker click keeps its user gesture.
  const pick = useCallback(
    (kind: Extract<ImageKind, 'camera' | 'gallery'>) => {
      setSourceMenu(false);
      add(kind);
    },
    [add],
  );

  const doRemove = useCallback(
    async (img: ImageRecord) => {
      await softDeleteImage(database, img.id);
      load();
    },
    [load],
  );

  const remove = useCallback(
    (img: ImageRecord) => {
      // Alert here is the cross-platform shim (window.confirm on web, native Alert on device).
      Alert.alert('Remove photo', 'Remove this photo from the set?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => doRemove(img) },
      ]);
    },
    [doRemove],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Photos</Text>
      <View style={styles.grid}>
        {images.map((img) => (
          <Thumbnail key={img.id} img={img} onRemove={() => remove(img)} />
        ))}
        <Pressable style={styles.addTile} onPress={onAdd}>
          <PlusIcon width={20} height={20} color={colors.accent} />
          <Text style={styles.addLabel}>Add photo</Text>
        </Pressable>
      </View>

      {/* Web-only source chooser (native uses the Alert action sheet above). */}
      <Modal
        visible={sourceMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setSourceMenu(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSourceMenu(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add photo</Text>
            <Pressable style={styles.sheetItem} onPress={() => pick('camera')}>
              <Text style={styles.sheetItemText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={() => pick('gallery')}>
              <Text style={styles.sheetItemText}>Choose from gallery</Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={() => setSourceMenu(false)}>
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * One image tile. Split out so the platform image-src resolver (a hook) has a valid call
 * site — on web it turns the row's `idb-image://` uri into an object URL; on native it's a
 * passthrough of the `file://` path.
 */
function Thumbnail({ img, onRemove }: { img: ImageRecord; onRemove: () => void }) {
  const src = useImageSrc(img.localUri);
  return (
    <View style={styles.thumbWrap}>
      <Image source={src ? { uri: src } : undefined} style={styles.thumb} />
      <Pressable style={styles.removeBtn} hitSlop={8} onPress={onRemove}>
        <PlusIcon color="#fff" width={12} height={12} style={{ transform: [{ rotate: '45deg' }] }} />
      </Pressable>
    </View>
  );
}

const THUMB = 84;

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  label: { fontFamily: fonts.medium, fontSize: 16, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingInline: space.md },
  thumbWrap: { width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.line },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 14, lineHeight: 16 },
  addTile: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPlus: { fontFamily: fonts.bold, fontSize: 22, color: colors.accent },
  addLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: space.md,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.sm,
    gap: 2,
  },
  sheetTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: space.sm,
  },
  sheetItem: { paddingVertical: space.md, alignItems: 'center', borderRadius: radius.md },
  sheetItemText: { fontFamily: fonts.medium, fontSize: 17, color: colors.accent },
  sheetCancel: { fontFamily: fonts.body, fontSize: 17, color: colors.muted },
});
