/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primaryBlue: "#0A3FFF",
        accentCyan: "#00B4FF",
        textWhite: "#FFFFFF",
        buttonBlack: "#000000"
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        satoshi: ['Satoshi', 'system-ui', 'sans-serif'],
      },
      gridTemplateColumns: {
        '12': 'repeat(12, minmax(0, 1fr))',
      }
    },
  },
  plugins: [],
}
