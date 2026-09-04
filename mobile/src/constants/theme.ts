/**
 * Fast Consultants theme — red & white (matches web index.css)
 * Web: --accent #f24e68, --accent-strong #e02a48, --accent-soft #fff0f3
 */

import { Platform } from 'react-native';

export const Brand = {
  primary: '#F24E68',
  primaryStrong: '#E02A48',
  primarySoft: '#FFF0F3',
  authMid: '#C41E3A',
  accent: '#F24E68',
  accentMuted: '#FFF0F3',
  ink: '#16171A',
  muted: '#5F5F5F',
  line: '#E8E8EA',
  canvas: '#F5F5F7',
  surface: '#FFFFFF',
  warning: '#FCB900',
  danger: '#F24E68',
  success: '#2F9E6B',
  successMuted: '#C1F2D0',
  dangerMuted: '#FFF0F3',
  warningMuted: '#FFF3C4',
  /** Matches web primary-btn: linear-gradient(135deg, #f24e68, #e02a48) */
  buttonGradient: ['#F24E68', '#E02A48'] as const,
  /** Matches web .auth-screen background */
  authGradient: ['#16171A', '#C41E3A', '#F24E68'] as const,
  /** Dashboard progress: dark red → bright cherry as the bar advances */
  progressGradient: ['#C41E3A', '#E02A48', '#F24E68', '#FFB3C1'] as const,
  /** Progress fill on red hero cards — soft white → full white */
  progressOnRedGradient: [
    'rgba(255,255,255,0.52)',
    'rgba(255,255,255,0.72)',
    'rgba(255,255,255,0.9)',
    '#FFFFFF',
  ] as const,
} as const;

export const Colors = {
  light: {
    text: '#16171A',
    background: '#F5F5F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EEEFF4',
    textSecondary: '#5F5F5F',
    primary: '#F24E68',
    primaryStrong: '#E02A48',
    accent: '#F24E68',
    accentStrong: '#E02A48',
    accentSoft: '#FFF0F3',
    border: '#E8E8EA',
    success: '#2F9E6B',
    danger: '#F24E68',
    warning: '#FCB900',
    onPrimary: '#FFFFFF',
    iconButton: '#F24E68',
    iconButtonInk: '#FFFFFF',
    gradientStart: '#F5F5F7',
    inverted: '#F24E68',
    invertedText: '#FFFFFF',
    inputFill: '#EEEFF4',
    cardCoral: '#FFF1F4',
    cardGold: '#FFF3C4',
    cardTeal: '#EEEFF4',
    cardLime: '#FFF0F3',
    successMuted: '#C1F2D0',
    dangerMuted: '#FFF0F3',
    warningMuted: '#FFF3C4',
  },
  dark: {
    text: '#F5F5F7',
    background: '#0F1012',
    backgroundElement: '#16171A',
    backgroundSelected: '#1E2024',
    textSecondary: '#A7AAAD',
    primary: '#FF6B84',
    primaryStrong: '#F24E68',
    accent: '#FF6B84',
    accentStrong: '#F24E68',
    accentSoft: '#3A1218',
    border: '#2E3035',
    success: '#4ADE80',
    danger: '#FF6B84',
    warning: '#FCB900',
    onPrimary: '#FFFFFF',
    iconButton: '#F24E68',
    iconButtonInk: '#FFFFFF',
    gradientStart: '#0F1012',
    inverted: '#F24E68',
    invertedText: '#FFFFFF',
    inputFill: '#1E2024',
    cardCoral: '#3A1520',
    cardGold: '#3A3010',
    cardTeal: '#1E2024',
    cardLime: '#3A1218',
    successMuted: '#163024',
    dangerMuted: '#3A1218',
    warningMuted: '#3A2E10',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = {
  display: 'DMSans_700Bold',
  body: 'DMSans_500Medium',
  bodyRegular: 'DMSans_400Regular',
  bodyBold: 'DMSans_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }) ?? 'monospace',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
