import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    middlewareMode: false,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    },
    proxy: {
      // Scoring backend API — strips /scoring-api prefix, forwards to backend.
      // In Docker: SCORING_API_URL=http://scoring-backend:4000
      // Locally:   falls back to http://localhost:4000
      "/scoring-api": {
        target: process.env.SCORING_API_URL ?? "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scoring-api/, "")
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "[name].[hash].js",
        chunkFileNames: "[name].[hash].js",
        assetFileNames: "[name].[hash][extname]"
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"]
  } as any
});
