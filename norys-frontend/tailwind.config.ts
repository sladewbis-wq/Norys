import type { Config } from "tailwindcss";

// Premium dark design system inspired by Linear / Notion / Raycast / Anthropic.
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep neutral surfaces (near-black, slightly warm).
        bg: {
          DEFAULT: "#0a0a0c",
          subtle: "#101013",
          elevated: "#16161a",
          inset: "#08080a",
        },
        border: {
          DEFAULT: "#222227",
          subtle: "#1a1a1f",
          strong: "#2e2e36",
        },
        content: {
          DEFAULT: "#ededf0",
          muted: "#9b9ba6",
          subtle: "#6c6c78",
        },
        // Brand accent — a calm indigo/violet, premium and enterprise.
        brand: {
          DEFAULT: "#6366f1",
          hover: "#7c7ef5",
          muted: "#4f46e5",
          subtle: "rgba(99,102,241,0.12)",
        },
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#f87171",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3)",
        glow: "0 0 0 1px rgba(99,102,241,0.2), 0 8px 32px rgba(99,102,241,0.15)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
