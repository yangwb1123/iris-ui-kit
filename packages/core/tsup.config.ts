import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/contracts/index.ts',
    'src/window.ts',
    'src/profile.ts',
    'src/commands.ts',
    'src/notifications.ts',
    'src/clipboard-history.ts',
    'src/fs.ts',
    'src/undo.ts',
    'src/audit-log.ts',
    'src/perf-stats.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
})
