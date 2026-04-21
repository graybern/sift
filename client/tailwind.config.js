/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stage: {
          inbox: { light: '#f1f5f9', dark: '#1e293b', accent: '#64748b' },
          'up-next': { light: '#fffbeb', dark: '#1c1917', accent: '#f59e0b' },
          'in-focus': { light: '#eff6ff', dark: '#0f172a', accent: '#3b82f6' },
          done: { light: '#f0fdf4', dark: '#052e16', accent: '#10b981' },
          someday: { light: '#faf5ff', dark: '#1e1b2e', accent: '#8b5cf6' },
        },
      },
    },
  },
  plugins: [],
};
