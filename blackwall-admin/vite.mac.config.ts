import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/** The installed Mac app has its own HTML entry and output bundle. */
export default defineConfig({
  root: path.resolve(import.meta.dirname, "src/mac"),
  publicDir: path.resolve(import.meta.dirname, "public"),
  plugins: [react(), tailwindcss()],
  define: { __BLACKWALL_BUILD__: JSON.stringify(process.env.BLACKWALL_BUILD_TREE ?? "") },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist-mac"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
})
