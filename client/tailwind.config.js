/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        saffron: {
          DEFAULT: '#FF9933',
          50: '#FFF4E5',
          100: '#FFE5C2',
          200: '#FFCC8A',
          300: '#FFB35C',
          400: '#FF9933',
          500: '#F58013',
          600: '#D86B0A',
          700: '#A8540A',
          800: '#7A3D0A',
          900: '#542B07',
        },
        india: {
          green: '#138808',
          'green-50': '#E8F5E5',
          'green-100': '#C7E8C0',
          'green-200': '#92D085',
          'green-300': '#52B043',
          'green-400': '#26961A',
          'green-700': '#0E6606',
          'green-900': '#0A4A04',
        },
        chakra: {
          DEFAULT: '#000080',
          900: '#000060',
        },
        ink: {
          DEFAULT: '#0E1330',
          900: '#080B22',
          800: '#141A3A',
          700: '#1F2747',
          600: '#2A3458',
        },
        cream: '#FFF8EC',
      },
      fontFamily: {
        display: ['"Cinzel"', '"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        royal: '0 8px 30px -8px rgba(0,0,128,0.45), 0 2px 0 #FF9933 inset',
        saffron: '0 6px 24px -6px rgba(255,153,51,0.55)',
      },
      keyframes: {
        spinChakra: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        diceShake: {
          '0%,100%': { transform: 'rotate(0deg) translate(0,0)' },
          '20%': { transform: 'rotate(-12deg) translate(-2px,1px)' },
          '40%': { transform: 'rotate(15deg) translate(2px,-1px)' },
          '60%': { transform: 'rotate(-8deg) translate(-1px,2px)' },
          '80%': { transform: 'rotate(10deg) translate(2px,0)' },
        },
      },
      animation: {
        chakra: 'spinChakra 18s linear infinite',
        diceShake: 'diceShake 0.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
