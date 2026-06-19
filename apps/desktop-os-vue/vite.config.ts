import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url))

// `serve` (dev) aliases @iris-ui/* to TS source for instant HMR; `build`/`preview`
// bundle the published dist. The `@iris-ui/core/window` subpath needs its OWN alias
// (listed BEFORE the bare `@iris-ui/core`) because the bare-specifier alias maps to
// a file, not a directory — proving the same window manager runs on Vue.
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  server: { port: 5181, strictPort: true },
  resolve:
    command === 'serve'
      ? {
          alias: {
            '@iris-ui/core/window': src('core/src/window.ts'),
            '@iris-ui/core': src('core/src/index.ts'),
            '@iris-ui/tokens': src('tokens/src/index.ts'),
            '@iris-ui/vue': src('vue/src/index.ts'),
          },
        }
      : {},
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
