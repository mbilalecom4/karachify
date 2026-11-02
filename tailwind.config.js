/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* Brand palette: dark teal #063231 + lime #cbff54 on #f5f5f2 / #333333.
         `navy` and `teal` keep their names — ~900 call sites read them as
         roles (chrome / accent), not as hues — but their values now sit in the
         teal ramp at the same luminance steps, so every contrast ratio the
         harness measured before still holds. Lime is only ever a fill behind
         dark type or a stroke; it is never text on white (1.2:1). */
      colors: {
        navy: {
          50: '#EDF4F3',
          100: '#CFE9E6',
          200: '#A9CFCA',
          300: '#7FB3AC',
          400: '#357A72',
          500: '#227A72',
          600: '#125954',
          700: '#0B423F',
          800: '#063231',
          900: '#042422',
          950: '#021A18',
        },
        teal: {
          50: '#F0FAF8',
          100: '#DFF1EE',
          200: '#CFE9E6',
          300: '#A9D8D2',
          400: '#6BB8B0',
          500: '#12857D',
          600: '#0A6A63',
          700: '#065450',
          800: '#063231',
          900: '#042625',
        },
        lime: {
          100: '#F3FFD6',
          200: '#E7FFA8',
          300: '#DBFF7E',
          400: '#D3FF66',
          500: '#CBFF54',
          600: '#B4EE32',
          700: '#8FBE1E',
          800: '#6B8F16',
        },
        brand: '#063231',
        khaki: '#CBFF54',
        gainsboro: '#CFE9E6',
        ink: '#333333',
        mist: '#F5F5F2',
        paper: '#FFFFFF',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(6,50,49,.07), 0 8px 24px -12px rgba(6,50,49,.20)',
        lift: '0 6px 16px -6px rgba(6,50,49,.20), 0 24px 48px -24px rgba(6,50,49,.30)',
        ring: '0 0 0 4px rgba(203,255,84,.45)',
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
