/** @type {import('tailwindcss').Config} */
// The website shares the same design tokens as the app (SYSTEM_PROMPT §4, §8):
// utilities map to the CSS variables in src/styles/tokens.css.
export default {
  content: ['./src/**/*.{astro,html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'var(--color-primary)', 600: 'var(--color-primary-600)' },
        accent: { DEFAULT: 'var(--color-accent)', 600: 'var(--color-accent-600)' },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
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
      maxWidth: {
        content: '1120px',
      },
    },
  },
  plugins: [],
};
