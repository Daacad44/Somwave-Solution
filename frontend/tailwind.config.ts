import type { Config } from 'tailwindcss';

// Tailwind maps to the CSS-variable tokens in src/styles/tokens.css (SYSTEM_PROMPT
// §8) — so `bg-primary`, `text-accent-600`, `shadow-md`, `rounded-lg` all resolve
// to the design system, and no raw hex or default palette class is needed.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'var(--color-primary)', 600: 'var(--color-primary-600)' },
        accent: { DEFAULT: 'var(--color-accent)', 600: 'var(--color-accent-600)' },
        success: { DEFAULT: 'var(--color-success)', soft: 'var(--color-success-soft)' },
        warning: { DEFAULT: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        brand: { DEFAULT: 'var(--color-brand)', soft: 'var(--color-brand-soft)' },
        sidebar: { DEFAULT: 'var(--color-sidebar)', muted: 'var(--color-sidebar-muted)' },
        canvas: 'var(--color-canvas)',
        banner: 'var(--color-banner)',
        invoice: { DEFAULT: 'var(--color-invoice)', soft: 'var(--color-invoice-soft)' },
        surface: { DEFAULT: 'var(--color-surface)', alt: 'var(--color-surface-alt)' },
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        ar: ['var(--font-ar)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
} satisfies Config;
