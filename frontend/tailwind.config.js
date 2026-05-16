/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Fira Sans", "system-ui", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      },
      colors: {
        brand: {
          orange: "#f97316",
          blue: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
}
