module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F97316',
          dark: '#C2410C',
          light: '#FDBA74',
          glow: 'rgba(249, 115, 22, 0.38)'
        },
        secondary: {
          DEFAULT: '#D1D5DB',
          dark: '#6B7280'
        },
        grafito: {
          900: '#050608',
          800: '#0D0D0F',
          700: '#171717',
          600: '#262626',
          500: '#525252'
        },
        accent: {
          DEFAULT: '#F97316',
          hover: '#EA580C',
          glow: 'rgba(249, 115, 22, 0.38)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(145deg, rgba(255, 255, 255, 0.07) 0%, rgba(249, 115, 22, 0.035) 100%)',
        'primary-gradient': 'linear-gradient(135deg, #FF9A18 0%, #F97316 48%, #C2410C 100%)',
        'whatsapp-gradient': 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-glow': '0 8px 32px 0 rgba(249, 115, 22, 0.22)',
        'premium': '0 10px 40px -10px rgba(0,0,0,0.5)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    }
  },
  plugins: []
};
