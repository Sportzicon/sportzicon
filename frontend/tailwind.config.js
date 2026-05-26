/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9ff",
          100: "#d8efff",
          200: "#b9e3ff",
          300: "#83d2ff",
          400: "#42b8ff",
          500: "#1697f7",
          600: "#0b77d8",
          700: "#0c5fae",
          800: "#10518f",
          900: "#134476",
          950: "#0a2a4d"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      }
    }
  },
  plugins: []
};
