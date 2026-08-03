import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
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
import ChevronRightIcon from '@/assets/icons/chevron-right.svg';

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
  const [current, setCurrent] = useState(index ?? 0);
  const listRef = useRef<FlatList<ImageRecord>>(null);

  const open = index != null;

  // Hide the pager's scrollbars on web. RNW's shows*ScrollIndicator only emits
  // `scrollbar-width: none` (Firefox); Chrome/Safari need `::-webkit-scrollbar{display:none}`,
  // a pseudo-element that can't be an inline style. Inject it once at runtime (rather than in
  // public/index.html, a build-time template that needs a Metro restart to pick up).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'gallery-noscrollbar-style';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent =
      '[data-noscrollbar]{scrollbar-width:none;-ms-overflow-style:none;}' +
      '[data-noscrollbar]::-webkit-scrollbar{display:none;}';
    document.head.appendChild(el);
  }, []);

  // Reset the indicator to the opened photo each time the viewer opens (the component stays
  // mounted, so the useState initializer is stale on reopen and initialScrollIndex doesn't
  // reliably fire onScroll on web).
  useEffect(() => {
    if (index != null) setCurrent(index);
  }, [index]);

  // Track the page from scroll offset. onScroll (vs onMomentumScrollEnd) is used because the
  // latter doesn't fire for paged FlatLists on react-native-web; the guard keeps setState to
  // one call per page crossing.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      setCurrent((prev) => (prev === page ? prev : page));
    },
    [width],
  );

  // Step one photo left/right via the arrow buttons.
  const go = useCallback(
    (dir: -1 | 1) => {
      setCurrent((prev) => {
        const next = prev + dir;
        if (next < 0 || next >= images.length) return prev;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    },
    [images.length],
  );

  if (!open) return null;

  // Tag the scroll node so the runtime-injected [data-noscrollbar] rule hides its scrollbars
  // on web (see the injection effect above). No-op / omitted on native.
  const webNoScrollbar = Platform.OS === 'web' ? { dataSet: { noscrollbar: 'true' } } : {};
  const showArrows = images.length > 1;

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
          showsVerticalScrollIndicator={false}
          {...webNoScrollbar}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScroll={onScroll}
          scrollEventThrottle={16}
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

        {showArrows ? (
          <>
            {current > 0 ? (
              <Pressable style={[styles.arrow, styles.arrowLeft]} hitSlop={8} onPress={() => go(-1)}>
                <ChevronRightIcon
                  color="#fff"
                  width={22}
                  height={22}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
              </Pressable>
            ) : null}
            {current < images.length - 1 ? (
              <Pressable style={[styles.arrow, styles.arrowRight]} hitSlop={8} onPress={() => go(1)}>
                <ChevronRightIcon color="#fff" width={22} height={22} />
              </Pressable>
            ) : null}
          </>
        ) : null}

        {showArrows ? (
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
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: space.md },
  arrowRight: { right: space.md },
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
