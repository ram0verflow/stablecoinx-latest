import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3b82f6',    // blue-500
          secondary: '#8b5cf6',  // violet-500
          accent: '#06b6d4',     // cyan-500
        },
        surface: {
          base: '#0a0a0f',       // page background
          card: '#0f1117',       // card background
          elevated: '#151821',   // elevated elements
          border: '#1e2433',     // borders
        },
        status: {
          pass: '#22c55e',       // green
          fail: '#ef4444',       // red
          pending: '#3b82f6',    // blue
          veto: '#f59e0b',       // amber
          review: '#f97316',     // orange
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
