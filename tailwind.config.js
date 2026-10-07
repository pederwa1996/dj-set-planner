/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0d12',
        panel: '#141821',
        panel2: '#1b2030',
        line: '#2a3142',
        muted: '#8b93a7',
        accent: '#22d3ee',
        good: '#22c55e',
        ok: '#eab308',
        bad: '#ef4444',
      },
    },
  },
  plugins: [],
};
