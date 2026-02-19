import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        wind: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#006838',
          800: '#1A2A1F',
          900: '#0A1F12',
          950: '#071510',
        },
        accent: {
          DEFAULT: '#FFC72C',
          light: '#FFD966',
          dark: '#E6A800',
        },
        surface: {
          DEFAULT: '#1A2A1F',
          light: '#243A2B',
          dark: '#111B14',
          card: '#1E3226',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
