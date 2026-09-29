/** Single source of truth for the "Dark Aurora" design system. */
export const tokens = {
  color: {
    bg: '#05050A',
    bgAmoled: '#000000',
    surface: 'rgba(255,255,255,0.06)',
    surfaceStrong: 'rgba(255,255,255,0.10)',
    border: 'rgba(255,255,255,0.12)',
    textHi: '#F5F5FA',
    textLo: '#9CA3AF',
    violet: '#7C3AED',
    blue: '#2563EB',
    cyan: '#06B6D4',
    magenta: '#EC4899',
    ok: '#22C55E',
    warn: '#F59E0B',
    danger: '#EF4444',
  },
  gradient: {
    primary: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 55%, #06B6D4 100%)',
    accent: 'linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)',
    border: 'linear-gradient(135deg, rgba(124,58,237,.7), rgba(6,182,212,.35))',
  },
  radius: { md: '16px', lg: '20px', xl: '24px', xxl: '28px', pill: '999px' },
  motion: {
    spring: { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 } as const,
    fast: 0.2,
    base: 0.3,
    slow: 0.4,
  },
  space: (n: number) => `${n * 4}px`,
  touchTarget: 48,
} as const;

export type Tokens = typeof tokens;
