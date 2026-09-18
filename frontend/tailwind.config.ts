import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2563eb',   // blue-600 — single accent
          hover: '#1d4ed8',     // blue-700
          soft: '#eff6ff',      // blue-50
        },
        navy: {
          950: '#0b1220',
          900: '#101a2e',
          800: '#16233d',
          700: '#1e2d4d',
          600: '#2a3c5e',
          400: '#5b6b8c',
          200: '#aab4c9',
        },
        surface: {
          base: '#f4f6f9',      // page background
          card: '#ffffff',      // card background
          elevated: '#f8fafc',  // inputs / elevated elements
          border: '#e2e6ee',    // borders
        },
        ink: {
          900: '#0f172a',       // primary text (charcoal/navy)
          600: '#475569',       // secondary text
          400: '#94a3b8',       // muted text
        },
        status: {
          pass: '#16a34a',      // green-600
          review: '#d97706',    // amber-600
          blocked: '#dc2626',   // red-600
          processing: '#2563eb',// blue-600
          unknown: '#64748b',   // slate-500
        }
      },
    },
  },
  plugins: [],
};

export default config;
