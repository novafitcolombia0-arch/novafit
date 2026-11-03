/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        nova: {
          black: "#5a3a3a",
          dark: "#8b5e5e",
          rose: "#c08080",
          blush: "#e0c0c0",
          pink: "#ffe0e0",
          sand: "#c0a080",
          cream: "#faf5f2",
          lightgray: "#e5e0dc",
          gray: "#8a7a75",
        },
      },
      fontFamily: {
        sans: ["'Inter'", "sans-serif"],
        display: ["'Playfair Display'", "serif"],
      },
    },
  },
  plugins: [],
};
