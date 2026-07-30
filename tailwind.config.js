/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        dark: {
          50: '#eaeaef',
          100: '#c5c6d0',
          200: '#9d9eae',
          300: '#75778d',
          400: '#575974',
          500: '#393b5c',
          600: '#333554',
          700: '#2b2d4a',
          800: '#232541',
          900: '#1a1b30',
          950: '#111220',
        },
        accent: {
          50: '#eee5ff',
          100: '#d4bfff',
          200: '#b794ff',
          300: '#9a69ff',
          400: '#8348ff',
          500: '#6c28ff',
          600: '#6324ff',
          700: '#551cff',
          800: '#4716ff',
          900: '#2800ff',
        },
        neon: {
          purple: '#8b5cf6',
          blue: '#3b82f6',
          cyan: '#06b6d4',
          green: '#10b981',
          pink: '#ec4899',
          orange: '#f97316',
        }
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(139, 92, 246, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
