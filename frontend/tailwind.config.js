/** @type {import('tailwindcss').Config} */
// ============================================================================
// Sportivox — "Editorial Workstation" design system tokens.
// Re-skins the whole app: `brand` is now blaze-orange, plus warm paper / ink
// neutrals and the new type families. No page logic changes required.
// ============================================================================
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // brand = blaze orange (single active accent). Existing utilities like
        // bg-brand-600 / text-brand-700 / ring-brand-500 now render blaze.
        brand: {
          50: "#FEF1EC",
          100: "#FEE9E0",
          200: "#FBCDBA",
          300: "#F8A88B",
          400: "#FB7A4D",
          500: "#FA4D14",
          600: "#E23F0C",
          700: "#BC340B",
          800: "#922910",
          900: "#762512",
          950: "#400F06"
        },
        // warm editorial surface palette
        paper: "#F7F5EF",
        panel: "#FFFFFF",
        fill: "#F2F1EC",
        fill2: "#EBE9E1",
        ink: {
          DEFAULT: "#14110D",
          70: "#4A453D",
          sub: "#726B60",
          faint: "#9A9286"
        },
        hair: "rgba(20,17,13,0.13)",
        hairsoft: "rgba(20,17,13,0.07)"
      },
      fontFamily: {
        // body
        sans: ["'Public Sans'", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        // condensed athletic display
        display: ["'Oswald'", "'Saira Condensed'", "sans-serif"],
        // labels, stats, tabular numerals
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      borderRadius: {
        DEFAULT: "3px",
        lg: "4px",
        xl: "6px"
      },
      letterSpacing: {
        kicker: "0.2em",
        label: "0.13em"
      },
      boxShadow: {
        sm: "0 1px 2px rgba(20,17,13,0.04)",
        card: "0 1px 3px rgba(20,17,13,0.05)",
        pop: "0 18px 50px rgba(20,17,13,0.22)"
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        fadein: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        popin: { from: { opacity: "0", transform: "translateY(10px) scale(.99)" }, to: { opacity: "1", transform: "none" } }
      },
      animation: {
        shimmer: "shimmer 1.3s ease-in-out infinite",
        fadein: "fadein .28s ease both",
        popin: "popin .2s ease both"
      }
    }
  },
  plugins: []
};
