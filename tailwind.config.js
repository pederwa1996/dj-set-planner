/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Varme, mørke flater inspirert av Claude-appen
        bg: '#141312',
        sidebar: '#0e0d0c',
        surface: '#1c1a19',
        raised: '#272523',
        line: '#34312e',
        ink: '#f3efe7',
        ink2: '#bfb9ad',
        muted: '#8f897e',
        cream: '#f1ece2',
        accent: { DEFAULT: '#ef6a3a', strong: '#d9542a', soft: '#ef6a3a1f' },
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
