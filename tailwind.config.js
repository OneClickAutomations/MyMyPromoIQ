/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Near-black backgrounds with slight warmth — never pure black.
        void: {
          DEFAULT: '#0A0A0B',
          800: '#111113',
          700: '#161618',
          600: '#1C1C1F',
          500: '#26262A',
        },
        // Orange → red fire system (primary).
        fire: {
          start: '#FF6B35',
          end: '#E8341C',
          glow: '#FF6B35',
        },
        // Gold accent — used sparingly for "premium" cues.
        gold: {
          DEFAULT: '#F2B84B',
          soft: '#F7CE7A',
        },
        ink: {
          DEFAULT: '#F5F5F4',
          muted: '#A1A1A6',
          faint: '#6B6B72',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Geist"', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-fire': 'linear-gradient(135deg, #FF6B35 0%, #E8341C 100%)',
        'gradient-fire-soft': 'linear-gradient(135deg, rgba(255,107,53,0.18) 0%, rgba(232,52,28,0.12) 100%)',
      },
      boxShadow: {
        'fire-glow': '0 30px 80px -20px rgba(255,107,53,0.45), 0 10px 30px -10px rgba(232,52,28,0.35)',
        'fire-soft': '0 0 0 1px rgba(255,107,53,0.18), 0 18px 50px -18px rgba(255,107,53,0.30)',
        'gold-ring': '0 0 0 1px rgba(242,184,75,0.35)',
        'card': '0 24px 60px -28px rgba(0,0,0,0.85)',
      },
      letterSpacing: {
        'tightest': '-0.045em',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.85)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'float-slow 5s ease-in-out infinite',
        marquee: 'marquee 32s linear infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
}
