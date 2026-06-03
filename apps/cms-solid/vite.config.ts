import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'

/** Resolve a workspace package to its TS source entry (dev runs from source). */
const src = (name: string) =>
  fileURLToPath(
    new URL(`../../packages/${name}/src/index.${name === 'solid' ? 'tsx' : 'ts'}`, import.meta.url),
  )

// `serve` (dev) aliases @iris-ui/* to source for instant HMR; `build`/`preview`
// bundle the real published dist artifacts.
export default defineConfig(({ command }) => ({
  plugins: [solid()],
  server: {
    port: 5177,
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
            '@iris-ui/solid': src('solid'),
          },
        }
      : {},
}))
