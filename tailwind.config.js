/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic void/ink tokens — driven by CSS variables so light mode works.
        // Variables are space-separated RGB channels (e.g. "10 10 11") for
        // opacity-modifier support (bg-void-800/60 etc).
        void: {
          DEFAULT: 'rgb(var(--c-void) / <alpha-value>)',
          900: 'rgb(var(--c-void-900) / <alpha-value>)',
          800: 'rgb(var(--c-void-800) / <alpha-value>)',
          700: 'rgb(var(--c-void-700) / <alpha-value>)',
          600: 'rgb(var(--c-void-600) / <alpha-value>)',
          500: 'rgb(var(--c-void-500) / <alpha-value>)',
        },
        // Orange → red fire system (primary — fixed across modes).
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
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          muted: 'rgb(var(--c-ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--c-ink-faint) / <alpha-value>)',
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
        'card-light': '0 1px 3px 0 rgba(0,0,0,0.08), 0 4px 16px -4px rgba(0,0,0,0.06)',
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
        'grain-shift': {
          '0%':   { transform: 'translate(0, 0)' },
          '25%':  { transform: 'translate(-4px, 2px)' },
          '50%':  { transform: 'translate(2px, -4px)' },
          '75%':  { transform: 'translate(-2px, 4px)' },
          '100%': { transform: 'translate(4px, -2px)' },
        },
        'sound-pulse': {
          '0%, 100%': { borderColor: 'rgba(255,255,255,0.12)', boxShadow: '0 0 0 0 rgba(242,184,75,0)' },
          '50%':      { borderColor: 'rgba(242,184,75,0.5)', boxShadow: '0 0 0 3px rgba(242,184,75,0.08)' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'float-slow 5s ease-in-out infinite',
        marquee: 'marquee 32s linear infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'grain-shift': 'grain-shift 0.5s steps(2) infinite',
        'sound-pulse': 'sound-pulse 3s ease-in-out 2',
      },
    },
  },
  plugins: [],
}
