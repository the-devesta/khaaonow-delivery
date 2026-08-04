/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Default Tailwind line-heights (as tight as 1.11x for text-4xl) are
      // tuned for Latin script and clip the tops/bottoms of Gujarati/Hindi
      // glyphs, whose matras and conjuncts extend further past the
      // baseline. Font sizes are unchanged — only line-height grows to a
      // ~1.5x ratio, which gives Indic scripts room without materially
      // affecting Latin text layout.
      fontSize: {
        xs: ["12px", { lineHeight: "18px" }],
        sm: ["14px", { lineHeight: "21px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "27px" }],
        xl: ["20px", { lineHeight: "30px" }],
        "2xl": ["24px", { lineHeight: "36px" }],
        "3xl": ["30px", { lineHeight: "45px" }],
        "4xl": ["36px", { lineHeight: "54px" }],
      },
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
