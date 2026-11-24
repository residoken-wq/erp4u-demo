/** @type {import('tailwindcss').Config} */
// Synced from single source of truth: frontend/src/theme/brand.ts
// Note: tailwind.config.js is CommonJS/ESM executed by Node at build time; keep hex values synchronized with brand.ts
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#272F72", // Conix Navy
          hover: "#353F94",
          active: "#1D2459",
          selected: "#343E8F",
          subtle: "#F0F1F8",
        },
        accent: {
          DEFAULT: "#F04E23", // Conix Orange (CTA / Accent)
          hover: "#F26741",
          active: "#D63F17",
          dark: "#C53B13",   // Contrast >= 4.5:1 on white for small text
          subtle: "#FFF3EE",
        },
        cream: {
          DEFAULT: "#FFF5E1", // Conix Brand Cream
          layout: "#FAF8F5",  // Very light cream layout background
          hover: "#FFF9ED",
          border: "#F2E8D5",
        },
        mint: {
          DEFAULT: "#64FAE1", // Conix Mint (ONLY on Navy background)
          dark: "#0F766E",    // Dark mint variant for light backgrounds / charts
          subtle: "#E6FAF5",
        },
      }
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
}
