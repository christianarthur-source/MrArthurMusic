/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        serif: [
          'Newsreader',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        brand: {
          50: 'var(--brand-50, #f0f7ff)',
          100: 'var(--brand-100, #e0effe)',
          200: 'var(--brand-200, #bae0fd)',
          300: 'var(--brand-300, #7cc5fb)',
          400: 'var(--brand-400, #36a4f6)',
          500: 'var(--brand-500, #0c87eb)',
          600: 'var(--brand-600, #006bc9)',
          700: 'var(--brand-700, #0155a3)',
          800: 'var(--brand-800, #064986)',
          900: 'var(--brand-900, #0b3d6f)',
        },
      },
      gridTemplateColumns: {
        '16': 'repeat(16, minmax(0, 1fr))',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'elevated': '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
