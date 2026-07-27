import { defineConfig, type Options } from 'tsup'
import { solidSsrSafeBuild } from '../../scripts/solid-ssr-build.ts'

// Everything in @iris-ui-kit/* + the host framework runtimes stay external — the
// admin plugin composes the adapters' shell + data engine, it doesn't bundle them.
const IRIS = [
  '@iris-ui-kit/core',
  '@iris-ui-kit/react',
  '@iris-ui-kit/vue',
  '@iris-ui-kit/solid',
  '@iris-ui-kit/svelte',
]
const SELF_CORE = '@iris-ui-kit/plugin-admin/core'

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
  minify: true,
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  external: [...IRIS, SELF_CORE, 'react', 'react-dom', 'react/jsx-runtime', 'vue'],
}

// Solid entry — needs esbuild-plugin-solid for real Solid reactivity.
const solid: Options = {
  entry: { 'solid/index': 'src/solid/index.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: false,
  treeshake: true,
  minify: true,
  target: 'es2022',
  tsconfig: 'tsconfig.solid.json',
  ...solidSsrSafeBuild(),
  external: [...IRIS, SELF_CORE, 'solid-js', 'solid-js/web', 'solid-js/store'],
}

export default defineConfig([main, solid])
