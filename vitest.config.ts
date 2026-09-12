import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', '.next', 'tests/e2e', 'terraform'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
