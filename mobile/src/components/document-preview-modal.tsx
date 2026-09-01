import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DocumentPreviewModalProps = {
  visible: boolean;
  title: string;
  uri: string | null;
  mimeType?: string | null;
  onClose: () => void;
  onDownload?: () => void;
};

export function DocumentPreviewModal({
  visible,
  title,
  uri,
  mimeType,
  onClose,
  onDownload,
}: DocumentPreviewModalProps) {
  const theme = useTheme();
  const isImage = Boolean(mimeType?.startsWith('image/') || title.match(/\.(jpe?g|png|gif|webp)$/i));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.toolbar}>
            <ThemedText numberOfLines={1} style={styles.title} type="smallBold">
              {title}
            </ThemedText>
            <View style={styles.actions}>
              {onDownload ? (
                <Pressable onPress={onDownload} style={styles.actionBtn}>
                  <ThemedText type="smallBold">Share</ThemedText>
                </Pressable>
              ) : null}
              <Pressable onPress={onClose} style={styles.actionBtn}>
                <ThemedText type="smallBold">Close</ThemedText>
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.body} maximumZoomScale={3} minimumZoomScale={1}>
            {uri && isImage ? (
              <Image accessibilityLabel={title} resizeMode="contain" source={{ uri }} style={styles.image} />
            ) : (
              <ThemedText style={styles.fallback} themeColor="textSecondary" type="small">
                Preview is not available for this file type here. Tap Share to open it in another app.
              </ThemedText>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  panel: {
    borderRadius: 18,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  title: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  body: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: '#0f172a',
  },
  image: {
    width: '100%',
    height: 420,
  },
  fallback: {
    textAlign: 'center',
  },
});
