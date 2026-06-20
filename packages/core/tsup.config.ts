import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/contracts/index.ts',
    'src/window.ts',
    'src/profile.ts',
    'src/commands.ts',
    'src/notifications.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
})
