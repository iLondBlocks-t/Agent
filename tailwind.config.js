/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { 950: '#05050A', 900: '#0A0A12', 800: '#12121C' },
        aurora: { violet: '#7C3AED', blue: '#2563EB', cyan: '#06B6D4', magenta: '#EC4899' },
        txt: { hi: '#F5F5FA', lo: '#9CA3AF' },
        ok: '#22C55E', warn: '#F59E0B', danger: '#EF4444',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Cairo', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl2: '20px', xl3: '28px' },
      keyframes: {
        drift: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(6%,-8%,0) scale(1.15)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseGlow: { '0%,100%': { opacity: '0.65', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.08)' } },
      },
      animation: {
        drift: 'drift 22s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        pulseGlow: 'pulseGlow 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
