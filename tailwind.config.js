/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#080D18',
          surface: '#0D1524',
          card: '#121E30',
          elevated: '#17263d',
          border: '#1E2F4A',
          muted: '#2A3F63',
        },
        clinical: {
          DEFAULT: '#14b8a6', // Teal
          hover: '#0d9488',
          light: '#2dd4bf',
          cyan: '#06b6d4',
          glow: 'rgba(20, 184, 166, 0.25)',
        },
        electric: '#3b82f6', // Selected states
        vessel: '#f43f5e',   // Coral / High risk
        amber: {
          risk: '#f59e0b',   // Intermediate risk
        },
        oxygen: '#38bdf8',
        ink: '#f8fafc',      // Soft-white text
        subtext: '#94a3b8',  // Cool-gray secondary text
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0, 0, 0, 0.5)',
        card: '0 4px 20px rgba(0, 0, 0, 0.4)',
        glow: '0 0 25px rgba(20, 184, 166, 0.2)',
        'glow-coral': '0 0 25px rgba(244, 63, 94, 0.2)',
        'glow-amber': '0 0 25px rgba(245, 158, 11, 0.2)',
      },
    },
  },
  plugins: [],
};
