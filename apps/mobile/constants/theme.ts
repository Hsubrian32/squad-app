export const Colors = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  border: '#2A2A2A',
  accent: '#6C63FF',
  accentDim: '#4A44B5',
  accentLight: 'rgba(108, 99, 255, 0.15)',
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textTertiary: '#555555',
  success: '#4CAF50',
  successLight: 'rgba(76, 175, 80, 0.15)',
  warning: '#FF9800',
  warningLight: 'rgba(255, 152, 0, 0.15)',
  error: '#F44336',
  errorLight: 'rgba(244, 67, 54, 0.15)',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h4: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 16 },
  label: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
} as const;
