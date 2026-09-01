import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type InterviewVideoCallModalProps = {
  joinUrl: string;
  title?: string;
  subtitle?: string;
  studentName?: string | null;
  visible: boolean;
  onClose: () => void;
  onLeave?: () => void | Promise<void>;
};

/** Full-screen in-app Jitsi video call for mobile. */
export function InterviewVideoCallModal({
  joinUrl,
  title = 'Interview video call',
  subtitle,
  studentName,
  visible,
  onClose,
  onLeave,
}: InterviewVideoCallModalProps) {
  const theme = useTheme();
  const [leaving, setLeaving] = useState(false);

  async function handleLeave() {
    setLeaving(true);
    try {
      await onLeave?.();
      onClose();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.toolbar, { borderBottomColor: theme.border }]}>
          <View style={styles.toolbarCopy}>
            <ThemedText numberOfLines={1} type="smallBold">
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">
                {subtitle}
              </ThemedText>
            ) : null}
            {studentName ? (
              <ThemedText themeColor="textSecondary" type="caption">
                With {studentName}
              </ThemedText>
            ) : null}
          </View>
          <Pressable disabled={leaving} onPress={() => void handleLeave()} style={styles.leaveBtn}>
            <ThemedText type="smallBold" style={styles.leaveText}>
              {leaving ? 'Ending…' : 'Leave'}
            </ThemedText>
          </Pressable>
        </View>
        <WebView
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          javaScriptEnabled
          mediaCapturePermissionGrantType="grant"
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={['https://*']}
          source={{ uri: joinUrl }}
          startInLoadingState
          style={styles.webview}
        />
      </View>
    </Modal>
  );
}

type InterviewVideoCallLauncherProps = {
  joinUrl: string;
  title?: string;
  subtitle?: string;
  studentName?: string | null;
  onJoin?: () => void | Promise<void>;
  onLeave?: () => void | Promise<void>;
};

export function InterviewVideoCallLauncher({
  joinUrl,
  title,
  subtitle,
  studentName,
  onJoin,
  onLeave,
}: InterviewVideoCallLauncherProps) {
  const [open, setOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  async function handleOpen() {
    setJoining(true);
    try {
      await onJoin?.();
      setOpen(true);
    } finally {
      setJoining(false);
    }
  }

  return (
    <>
      <Pressable disabled={joining} onPress={() => void handleOpen()} style={styles.launchBtn}>
        <ThemedText type="smallBold" style={styles.launchText}>
          {joining ? 'Joining…' : 'Join in-app video call'}
        </ThemedText>
      </Pressable>
      <InterviewVideoCallModal
        joinUrl={joinUrl}
        onClose={() => setOpen(false)}
        onLeave={onLeave}
        studentName={studentName}
        subtitle={subtitle}
        title={title}
        visible={open}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarCopy: { flex: 1, gap: 4 },
  leaveBtn: {
    backgroundColor: Brand.danger,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  leaveText: { color: '#fff' },
  webview: { flex: 1, backgroundColor: '#0f172a' },
  launchBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: Spacing.one,
  },
  launchText: { color: '#fff' },
});
