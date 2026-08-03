import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type ImageRecord from '@/db/models/ImageRecord';
import { useImageSrc } from '@/lib/imageSrc';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import PlusIcon from '@/assets/icons/plus.svg';

/**
 * Full-screen photo lightbox for a set's images. Horizontal swipe pages between photos
 * (FlatList `pagingEnabled` — native swipe that also works on web), opened at the tapped
 * index. Close button + "n of N" indicator; no zoom, no in-viewer remove (removal stays on
 * the grid). Renders nothing when `index` is null.
 */
export function ImageViewer({
  images,
  index,
  onClose,
}: {
  images: ImageRecord[];
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const listRef = useRef<FlatList<ImageRecord>>(null);

  const open = index != null;

  // Sync the indicator to the settled page after a swipe.
  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setCurrent(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  if (!open) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(img) => img.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => <Page img={item} width={width} height={height} />}
        />

        <Pressable style={styles.closeBtn} hitSlop={8} onPress={onClose}>
          <PlusIcon
            color="#fff"
            width={18}
            height={18}
            style={{ transform: [{ rotate: '45deg' }] }}
          />
        </Pressable>

        {images.length > 1 ? (
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>
              {current + 1} of {images.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * One full-screen page. Wraps `useImageSrc` so the platform src resolver has a valid hook
 * call site per image (same pattern as the grid Thumbnail).
 */
function Page({ img, width, height }: { img: ImageRecord; width: number; height: number }) {
  const src = useImageSrc(img.localUri);
  return (
    <View style={[styles.page, { width, height }]}>
      <Image
        source={src ? { uri: src } : undefined}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  page: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    top: space.xxl,
    right: space.lg,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    bottom: space.xxl,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  counterText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: '#fff' },
});
