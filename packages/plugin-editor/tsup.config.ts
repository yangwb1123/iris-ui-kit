import { defineConfig, type Options } from 'tsup'
import { solidPlugin } from 'esbuild-plugin-solid'

const IRIS = ['@iris-ui-kit/core']
const CM = [
  '@codemirror/state',
  '@codemirror/view',
  '@codemirror/commands',
  '@codemirror/language',
  '@codemirror/lang-sql',
  '@codemirror/lang-json',
  '@codemirror/lang-javascript',
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
  external: [...IRIS, ...CM, 'react', 'react-dom', 'react/jsx-runtime', 'vue'],
}

// Solid entry — needs esbuild-plugin-solid (babel-preset-solid) for real Solid
// reactivity. Separate config so its jsx settings don't touch the React entry.
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
  external: [...IRIS, ...CM, 'solid-js', 'solid-js/web', 'solid-js/store'],
}

export default defineConfig([main, solid])
