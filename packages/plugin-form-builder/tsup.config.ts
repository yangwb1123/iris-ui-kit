import { defineConfig, type Options } from 'tsup'
import { solidPlugin } from 'esbuild-plugin-solid'

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
  clean: true,
  treeshake: true,
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  external: [
    ...IRIS,
    '@iris-ui-kit/react',
    '@iris-ui-kit/react/form',
    '@iris-ui-kit/vue',
    '@iris-ui-kit/vue/form',
    'react',
    'react-dom',
    'react/jsx-runtime',
    'vue',
  ],
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
  external: [
    ...IRIS,
    '@iris-ui-kit/solid',
    '@iris-ui-kit/solid/form',
    'solid-js',
    'solid-js/web',
    'solid-js/store',
  ],
}

export default defineConfig([main, solid])
