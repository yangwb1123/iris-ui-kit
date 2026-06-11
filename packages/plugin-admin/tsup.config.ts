import { defineConfig, type Options } from 'tsup'
import { solidPlugin } from 'esbuild-plugin-solid'

// Everything in @iris-ui/* + the host framework runtimes stay external — the
// admin plugin composes the adapters' shell + data engine, it doesn't bundle them.
const IRIS = [
  '@iris-ui/core',
  '@iris-ui/react',
  '@iris-ui/vue',
  '@iris-ui/solid',
  '@iris-ui/svelte',
]

// Main entries (core + react + vue) — plain esbuild handles TS + React JSX.
const main: Options = {
  entry: {
    'core/index': 'src/core/index.ts',
    'react/index': 'src/react/index.tsx',
    'vue/index': 'src/vue/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  external: [...IRIS, 'react', 'react-dom', 'react/jsx-runtime', 'vue'],
}

// Solid entry — needs esbuild-plugin-solid for real Solid reactivity.
const solid: Options = {
  entry: { 'solid/index': 'src/solid/index.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: false,
  treeshake: true,
  target: 'es2022',
  tsconfig: 'tsconfig.solid.json',
  esbuildPlugins: [solidPlugin()],
  external: [...IRIS, 'solid-js', 'solid-js/web', 'solid-js/store'],
}

export default defineConfig([main, solid])
