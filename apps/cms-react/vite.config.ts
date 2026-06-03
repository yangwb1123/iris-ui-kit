import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/** Resolve a workspace package to its TS source entry (dev runs from source). */
const src = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

// `serve` (dev) aliases @iris-ui/* to source for instant HMR; `build`/`preview`
// bundle the real published dist artifacts.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    port: 5176,
    strictPort: true,
  },
  resolve:
    command === 'serve'
      ? {
          alias: {
            '@iris-ui/core': src('core'),
            '@iris-ui/tokens': src('tokens'),
            '@iris-ui/theme': src('theme'),
            '@iris-ui/skins': src('skins'),
            '@iris-ui/icons': src('icons'),
            '@iris-ui/react': src('react'),
          },
        }
      : {},
}))
