/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          blue: '#00f0ff',
          pink: '#ff007f',
          yellow: '#ffe600',
          dark: '#0a0f1d',
        }
      },
      fontFamily: {
        game: ['Outfit', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
