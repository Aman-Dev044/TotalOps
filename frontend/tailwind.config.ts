import type { Config } from 'tailwindcss';

const v = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        fg: v('fg'),
        card: v('card'),
        muted: v('muted'),
        'muted-fg': v('muted-fg'),
        line: v('line'),
        primary: v('primary'),
        'primary-fg': v('primary-fg'),
        accent: v('accent'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '0.85rem', '2xl': '1.1rem' },
      boxShadow: {
        soft: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
        lift: '0 10px 40px -12px rgb(15 23 42 / 0.25)',
        glow: '0 0 0 1px hsl(var(--primary) / 0.25), 0 8px 30px -8px hsl(var(--primary) / 0.45)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'pulse-ring': { '0%': { transform: 'scale(.8)', opacity: '0.8' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        floaty: 'floaty 5s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(.2,.6,.4,1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
