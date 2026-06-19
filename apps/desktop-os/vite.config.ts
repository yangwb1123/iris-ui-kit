import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url))

// `serve` (dev) aliases @iris-ui/* to TS source for instant HMR; `build`/`preview`
// bundle the published dist. The `@iris-ui/core/window` subpath needs its own
// alias because the bare-specifier alias maps to a file, not a directory.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5180, strictPort: true },
  resolve:
    command === 'serve'
      ? {
          alias: {
            '@iris-ui/core/window': src('core/src/window.ts'),
            '@iris-ui/core/profile': src('core/src/profile.ts'),
            '@iris-ui/core/commands': src('core/src/commands.ts'),
            '@iris-ui/core': src('core/src/index.ts'),
            '@iris-ui/tokens': src('tokens/src/index.ts'),
            '@iris-ui/theme': src('theme/src/index.ts'),
            '@iris-ui/skins': src('skins/src/index.ts'),
            '@iris-ui/icons': src('icons/src/index.ts'),
            '@iris-ui/react': src('react/src/index.ts'),
          },
        }
      : {},
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
