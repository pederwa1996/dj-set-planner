/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Varme, mørke flater inspirert av Claude-appen
        bg: '#262624',
        sidebar: '#1f1e1d',
        surface: '#30302e',
        raised: '#3a3936',
        line: '#44433f',
        ink: '#f5f4ee',
        ink2: '#c9c7bd',
        muted: '#9c9a91',
        cream: '#f0eee6',
        accent: { DEFAULT: '#d97757', strong: '#c6613f', soft: '#d977571f' },
        // Status (alltid sammen med ikon + ord)
        good: '#0ca30c',
        ok: '#fab219',
        bad: '#d03b3b',
        // Dataserier
        energy: '#d95926',
        tempo: '#3987e5',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        serif: ['"Source Serif 4 Variable"', 'ui-serif', 'Georgia', 'serif'],
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'pop-in': { from: { opacity: 0, transform: 'translateY(8px) scale(0.98)' }, to: { opacity: 1, transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in': 'slide-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
