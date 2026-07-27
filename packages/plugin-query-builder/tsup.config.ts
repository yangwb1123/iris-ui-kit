import { defineConfig, type Options } from 'tsup'
import { solidSsrSafeBuild } from '../../scripts/solid-ssr-build.ts'

const IRIS = ['@iris-ui-kit/core']
const SELF_CORE = '@iris-ui-kit/plugin-query-builder/core'

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
