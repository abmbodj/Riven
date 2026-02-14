/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Serif 4"', 'Georgia', 'Cambria', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        claude: {
          bg: 'var(--bg-color)',
          surface: 'var(--surface-color)',
          text: 'var(--text-color)',
          secondary: 'var(--secondary-text-color)',
          border: 'var(--border-color)',
          accent: 'var(--accent-color)',
        },
        botanical: {
          forest: 'var(--botanical-forest)',
          sepia: 'var(--botanical-sepia)',
          parchment: 'var(--botanical-parchment)',
          ink: 'var(--botanical-ink)',
        }
      },
      boxShadow: {
        'botanical': '0 2px 16px rgba(45,106,79,0.12), 0 1px 4px rgba(0,0,0,0.15)',
        'botanical-lg': '0 8px 32px rgba(45,106,79,0.18), 0 2px 8px rgba(0,0,0,0.2)',
        'botanical-glow': '0 0 24px rgba(82,183,136,0.15)',
      },
    },
  },
  plugins: [],
}
