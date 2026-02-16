/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FFD600", // Yellow/Amber
          50: "#FFFDE7",
          100: "#FFF9C4",
          200: "#FFF59D",
          300: "#FFF176",
          400: "#FFEE58",
          500: "#FFEB3B",
          600: "#FDD835",
          700: "#FBC02D",
          800: "#F9A825",
          900: "#F57F17",
        },
        secondary: "#3F2E05", // Dark brown/black for contrast
      },
    },
  },
  plugins: [],
};
