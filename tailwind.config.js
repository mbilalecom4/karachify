/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#EEF4F9',
          100: '#D8E4EE',
          200: '#AFC6DB',
          300: '#7FA2C1',
          400: '#4E7AA3',
          500: '#2C567D',
          600: '#1B3F61',
          700: '#15334F',
          800: '#102A43',
          900: '#0B1E31',
          950: '#06131F',
        },
        teal: {
          50: '#E8F8F6',
          100: '#C6EDE9',
          200: '#93DCD4',
          300: '#5BC6BB',
          400: '#2CB2A6',
          500: '#13A89E',
          600: '#0E8F88',
          700: '#0B736E',
          800: '#095A57',
          900: '#07413F',
        },
        ink: '#172B4D',
        mist: '#F5F8FA',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,42,67,.06), 0 8px 24px -12px rgba(16,42,67,.18)',
        lift: '0 6px 16px -6px rgba(16,42,67,.18), 0 24px 48px -24px rgba(16,42,67,.28)',
        ring: '0 0 0 4px rgba(19,168,158,.14)',
      },
      borderRadius: {
        xl2: '1.25rem',
        '3xl': '1.75rem',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .5s ease-out both',
        'fade-in': 'fade-in .4s ease-out both',
      },
    },
  },
  plugins: [],
};
