import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { database } from '@/db';
import type ImageRecord from '@/db/models/ImageRecord';
import { imagesForSet, createImage, softDeleteImage, type ImageKind } from '@/repositories/images';
import { captureFromCamera, pickFromGallery } from '@/lib/images';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

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

  const onAdd = useCallback(() => {
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => add('camera') },
      { text: 'Choose from gallery', onPress: () => add('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [add]);

  const remove = useCallback(
    (img: ImageRecord) => {
      Alert.alert('Remove photo', 'Remove this photo from the set?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await softDeleteImage(database, img.id);
            load();
          },
        },
      ]);
    },
    [load],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Photos</Text>
      <View style={styles.grid}>
        {images.map((img) => (
          <View key={img.id} style={styles.thumbWrap}>
            <Image source={{ uri: img.localUri }} style={styles.thumb} />
            <Pressable style={styles.removeBtn} hitSlop={8} onPress={() => remove(img)}>
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addTile} onPress={onAdd}>
          <Text style={styles.addPlus}>＋</Text>
          <Text style={styles.addLabel}>Add photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const THUMB = 84;

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
});
