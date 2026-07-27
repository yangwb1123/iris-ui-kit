import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/core/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: ['@iris-ui-kit/core'],
})
