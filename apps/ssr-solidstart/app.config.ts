import { defineConfig } from '@solidjs/start/config'
import { fileURLToPath } from 'node:url'

const irisSolidSource = fileURLToPath(
  new URL('../../packages/solid/src/index.tsx', import.meta.url),
)

export default defineConfig({
  ssr: true,
  server: { port: 5183 },
  vite: {
    resolve: {
      alias: {
        '@iris-ui-kit/solid': irisSolidSource,
      },
    },
    ssr: {
      noExternal: [/solid-js/, /@solidjs/, /@iris-ui-kit/],
    },
  },
})
