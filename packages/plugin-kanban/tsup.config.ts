import { defineConfig, type Options } from 'tsup'
import { solidSsrSafeBuild } from '../../scripts/solid-ssr-build.ts'

const IRIS = ['@iris-ui-kit/core']

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
  clean: false,
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
  ...solidSsrSafeBuild(),
  external: [...IRIS, 'solid-js', 'solid-js/web', 'solid-js/store'],
}

export default defineConfig([main, solid])
