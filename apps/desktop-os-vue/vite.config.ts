import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url))

// `serve` (dev) aliases @iris-ui-kit/* to TS source for instant HMR; `build`/`preview`
// bundle the published dist. The `@iris-ui-kit/core/window` subpath needs its OWN alias
// (listed BEFORE the bare `@iris-ui-kit/core`) because the bare-specifier alias maps to
// a file, not a directory — proving the same window manager runs on Vue.
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  server: { port: 5181, strictPort: true },
  resolve:
    command === 'serve'
      ? {
          alias: {
            '@iris-ui-kit/core/window': src('core/src/window.ts'),
            '@iris-ui-kit/core/profile': src('core/src/profile.ts'),
            '@iris-ui-kit/core/commands': src('core/src/commands.ts'),
            '@iris-ui-kit/core/notifications': src('core/src/notifications.ts'),
            '@iris-ui-kit/core/clipboard-history': src('core/src/clipboard-history.ts'),
            '@iris-ui-kit/core/fs': src('core/src/fs.ts'),
            '@iris-ui-kit/core/undo': src('core/src/undo.ts'),
            '@iris-ui-kit/core/grid': src('core/src/grid.ts'),
            '@iris-ui-kit/core': src('core/src/index.ts'),
            '@iris-ui-kit/tokens': src('tokens/src/index.ts'),
            '@iris-ui-kit/vue': src('vue/src/index.ts'),
          },
        }
      : {},
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
