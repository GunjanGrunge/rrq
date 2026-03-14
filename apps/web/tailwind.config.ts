import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0a0a",
          surface: "#111111",
          elevated: "#1a1a1a",
          border: "#222222",
          "border-hover": "#333333",
        },
        accent: {
          primary: "#f5a623",
          "primary-hover": "#f0b84a",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
          info: "#3b82f6",
        },
        text: {
          primary: "#f0ece4",
          secondary: "#a8a09a",
          tertiary: "#4a4540",
          inverse: "#0a0a0a",
        },
      },
      fontFamily: {
        syne: ["var(--font-syne)", "sans-serif"],
        "dm-mono": ["var(--font-dm-mono)", "monospace"],
        lora: ["var(--font-lora)", "serif"],
      },
      animation: {
        "pulse-amber": "pulseAmber 1.2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        pulseAmber: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
