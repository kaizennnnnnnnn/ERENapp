import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/types/**/*.{js,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Pocket Eren brand palette
        pink: {
          brand: '#FF6B9D',
          light: '#FFD6E7',
          soft: '#FFF0F7',
        },
        purple: {
          brand: '#A78BFA',
          light: '#EDE9FE',
        },
        cream: {
          DEFAULT: '#FDF6FF',
          card: '#FFFAF7',
        },
        // Eren's Ragdoll palette (used in pixel art)
        eren: {
          cream: '#F9EDD5',
          beige: '#D4B896',
          mask: '#9B7A5C',
          dark: '#4A2E1A',
          eye: '#6BAED6',
          nose: '#F48B9B',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      animation: {
        'breath': 'breath 3s ease-in-out infinite',
        'tail-sway': 'tailSway 2s ease-in-out infinite',
        'blink': 'blink 4s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'sway': 'sway 4s ease-in-out infinite',
        'twinkle': 'twinkle 2s ease-in-out infinite',
      },
      keyframes: {
        breath: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(1.03)' },
        },
        tailSway: {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        blink: {
          '0%, 90%, 100%': { scaleY: '1' },
          '95%': { scaleY: '0.1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        sway: {
          '0%, 100%': { transform: 'rotate(-3deg) translateY(0px)' },
          '50%': { transform: 'rotate(3deg) translateY(-3px)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(0.7)' },
        },
      },
      boxShadow: {
        'card': '0 2px 20px rgba(167,139,250,0.12)',
        'card-hover': '0 4px 30px rgba(167,139,250,0.22)',
        'pink': '0 4px 15px rgba(255,107,157,0.3)',
      },
    },
  },
  plugins: [],
}

export default config
