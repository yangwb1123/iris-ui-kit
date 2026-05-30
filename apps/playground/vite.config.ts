import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

/**
 * Resolve a workspace package to its TypeScript source entry.
 * Used in dev so the playground runs the libraries straight from source —
 * no build step, and edits to any `@iris-ui/*` package hot-reload instantly.
 */
const src = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

// In `serve` (dev) we alias to source; in `build` (and the `preview` that
// serves it) we leave the aliases off so the app bundles the real published
// `dist` artifacts.
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve:
    command === 'serve'
      ? {
          alias: {
            '@iris-ui/core': src('core'),
            '@iris-ui/tokens': src('tokens'),
            '@iris-ui/theme': src('theme'),
            '@iris-ui/icons': src('icons'),
            '@iris-ui/vue': src('vue'),
          },
        }
      : {},
}))
