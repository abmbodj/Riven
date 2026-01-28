/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        claude: {
          bg: 'var(--bg-color)',
          surface: 'var(--surface-color)',
          text: 'var(--text-color)',
          secondary: 'var(--secondary-text-color)',
          border: 'var(--border-color)',
          accent: 'var(--accent-color)',
        }
      }
    },
  },
  plugins: [],
}

