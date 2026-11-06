/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        nova: {
          black: "#000000",
          dark: "#1e1e1e",
          rose: "#b59677",
          blush: "#e6e6e6",
          pink: "#f8f0e4",
          sand: "#b59677",
          cream: "#ffffff",
          lightgray: "#eae3e6",
          gray: "#696969",
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
