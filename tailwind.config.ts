import type { Config } from 'tailwindcss'
// Static import, not require(): Node loads this .ts config through its ESM
// path, where `require` is undefined. A require() here throws inside Tailwind's
// loadConfig, PostCSS fails, and the stylesheet silently never gets built.
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        myanmar: ['var(--font-myanmar)', 'Padauk', 'Noto Sans Myanmar', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
        },
        /* Alpha-carrying tokens, so one class works on every surface in both
           themes. `border-hairline hover:border-hairline-strong` is the standard
           card edge; `bg-overlay-hover` is the standard row hover. */
        hairline: 'var(--hairline)',
        'hairline-strong': 'var(--hairline-strong)',
        'overlay-subtle': 'var(--overlay-subtle)',
        'overlay-hover': 'var(--overlay-hover)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      /**
       * Gesture-bar clearance.
       *
       * `max()` rather than the raw inset: on a desktop browser or an older phone
       * `env(safe-area-inset-bottom)` resolves to 0, and a bare inset would leave
       * a CTA flush against the viewport edge. The floor keeps ordinary padding
       * everywhere and grows only where the OS reserves space.
       *
       * Only works because the root layout sets `viewportFit: 'cover'`; without
       * it iOS reports every inset as 0.
       */
      padding: {
        'safe-b': 'max(2rem, env(safe-area-inset-bottom))',
        'safe-b-sm': 'max(1rem, env(safe-area-inset-bottom))',
        /** Just the inset, no floor — for bars that already have their own padding. */
        'safe-b-0': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
      /**
       * Clearance for content sitting above the fixed mobile tab bar.
       * 56px bar + whatever the OS reserves below it.
       */
      spacing: {
        'nav-b': 'calc(3.5rem + env(safe-area-inset-bottom))',
        'nav-b-fab': 'calc(4.5rem + env(safe-area-inset-bottom))',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        /* Skeletons sweep rather than blink: a pulse on a dark ground reads as a
           flicker, while a travelling highlight reads as "loading". */
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [animate],
}

export default config
