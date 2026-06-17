/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:     ['Satoshi', 'system-ui', 'sans-serif'],
        display:  ['Bricolage Grotesque', 'sans-serif'],
      },
      colors: {
        stone: {
          50:  'oklch(0.988 0.004 68)',
          100: 'oklch(0.958 0.007 68)',
          150: 'oklch(0.945 0.009 68)',
          200: 'oklch(0.910 0.011 68)',
          300: 'oklch(0.840 0.014 68)',
          500: 'oklch(0.570 0.014 68)',
          700: 'oklch(0.400 0.013 68)',
          900: 'oklch(0.160 0.010 68)',
        },
        amber: {
          50:  'oklch(0.975 0.024 65)',
          100: 'oklch(0.942 0.048 64)',
          200: 'oklch(0.888 0.082 60)',
          500: 'oklch(0.680 0.148 54)',
          600: 'oklch(0.580 0.148 52)',
          700: 'oklch(0.490 0.130 50)',
        },
      },
      animation: {
        'slide-in':   'slideIn 0.2s ease-out',
        'fade-in':    'fadeIn 0.15s ease-out',
        'scale-in':   'scaleIn 0.15s ease-out',
      },
      keyframes: {
        slideIn:  { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn:  { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
