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
      // Mirrors theme/tokens.ts — keep the two in sync.
      colors: {
        brand: { DEFAULT: "#FFD233", dark: "#E6B800", soft: "#FFF6CC" },
        ink: { DEFAULT: "#111827", soft: "#374151" },
        muted: "#6B7280",
        faint: "#9CA3AF",
        line: "#E5E7EB",
        canvas: "#F6F6F3",
        surface: "#FFFFFF",
        success: { DEFAULT: "#16A34A", soft: "#DCFCE7" },
        danger: { DEFAULT: "#DC2626", soft: "#FEE2E2" },
        warning: { DEFAULT: "#D97706", soft: "#FEF3C7" },
        info: { DEFAULT: "#2563EB", soft: "#DBEAFE" },
      },
    },
  },
  plugins: [],
};
