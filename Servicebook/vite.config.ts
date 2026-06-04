import fs from 'fs';
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': '/src',
    },
  },
  server: {
    https: (fs.existsSync(new URL('../backend/key.pem', import.meta.url)) && fs.existsSync(new URL('../backend/cert.pem', import.meta.url)))
      ? {
          key: fs.readFileSync(new URL('../backend/key.pem', import.meta.url)),
          cert: fs.readFileSync(new URL('../backend/cert.pem', import.meta.url)),
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'https://127.0.0.1:5001',
        changeOrigin: true,
        ws: true,
        secure: false, // Accept self-signed certificates
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/app/components/firm/scheduleDomain.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
})
