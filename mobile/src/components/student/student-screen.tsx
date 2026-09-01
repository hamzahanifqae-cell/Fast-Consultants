import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type RefreshControlProps,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderMenuButton } from '@/components/header-menu-button';
import { BrandLogo } from '@/components/brand-logo';
import { StudentNotificationIcon } from '@/components/student/student-notification-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StudentScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: object;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  notifications?: boolean;
  showMenu?: boolean;
  onMenuPress?: () => void;
};

export function StudentScreen({
  children,
  scroll = true,
  refreshControl,
  contentStyle,
  title,
  subtitle,
  showBack = false,
  notifications = true,
  showMenu = false,
  onMenuPress,
}: StudentScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const androidStatusBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
  const topPadding =
    Platform.OS === 'android'
      ? Math.max(insets.top, androidStatusBar) + Spacing.two
      : Spacing.two;

  const header = (
    <View style={[styles.topBar, { paddingTop: topPadding }]}>
      <View style={styles.topBarSide}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            style={[styles.circleBtn, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">←</ThemedText>
          </Pressable>
        ) : showMenu && onMenuPress ? (
          <HeaderMenuButton onPress={onMenuPress} />
        ) : (
          <View style={styles.circleBtn} />
        )}
      </View>

      {!showBack ? (
        <View style={styles.headerBrandCenter} pointerEvents="none">
          <BrandLogo size={36} style={styles.headerLogo} />
          <ThemedText type="heading" style={styles.headerBrand} numberOfLines={1}>
            Fast Consultants
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.topBarSide}>
        {notifications ? <StudentNotificationIcon /> : <View style={styles.circleBtn} />}
      </View>
    </View>
  );

  const pageTitle =
    title || subtitle ? (
      <View style={styles.titleBlock}>
        {title ? <ThemedText type="heading">{title}</ThemedText> : null}
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    ) : null;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {pageTitle}
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>
      {pageTitle}
      {children}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView
        edges={Platform.OS === 'android' ? ['left', 'right'] : ['top', 'left', 'right']}
        style={styles.safeArea}>
        {header}
        {body}
      </SafeAreaView>
    </View>
  );
}

export function StudentSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.surface, { backgroundColor: theme.backgroundElement }, style]}>
      {children}
    </View>
  );
}

export { RefreshControl };

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    position: 'relative',
    paddingHorizontal: Spacing.four,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSide: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerBrandCenter: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  headerBrand: {
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 24,
  },
  headerLogo: {
    flexShrink: 0,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  surface: {
    borderRadius: 28,
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
