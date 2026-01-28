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
          bg: '#f9f7f2',
          surface: '#ffffff',
          text: '#1d1d1b',
          secondary: '#6b6b6b',
          border: '#e5e2da',
          accent: '#d97757',
        }
      }
    },
  },
  plugins: [],
}

