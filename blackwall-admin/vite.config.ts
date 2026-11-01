import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { blackwallConnector } from './server/plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), blackwallConnector(import.meta.dirname)],
  // The Dockerfile sets this so the page knows which version it is and can tell when the server has a newer one.
  define: { __BLACKWALL_BUILD__: JSON.stringify(process.env.BLACKWALL_BUILD_TREE ?? "") },
  build: {
    rolldownOptions: {
      output: {
        // Keep app code small and cache-friendly; charts are the heaviest dependency.
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory-vendor|decimal\.js)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](radix-ui|@radix-ui|cmdk|sonner|react-day-picker|lucide-react|@floating-ui)/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared': path.resolve(import.meta.dirname, './shared'),
    },
  },
})
