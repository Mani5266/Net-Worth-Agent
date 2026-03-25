import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#1a5c3e",
          900: "#14532d",
        },
        navy: {
          50:  "#eef2ff",
          100: "#dce4fd",
          200: "#b9c9fc",
          300: "#8aa5f8",
          400: "#5a7ef2",
          500: "#3b5ee8",
          600: "#2544c7",
          700: "#1a3399",
          800: "#142870",
          900: "#0f1a2e",
          950: "#0b1220",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        serif: ["'Book Antiqua'", "Georgia", "serif"],
      },
      animation: {
        "spin-slow": "spin 0.8s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "float-delayed": "float 8s ease-in-out 2s infinite",
        "float-slow": "float 10s ease-in-out 1s infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
