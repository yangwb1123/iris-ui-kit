import { defineConfig } from 'tsup'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/contracts/index.ts',
    'src/window.ts',
    'src/profile.ts',
    'src/commands.ts',
    'src/notifications.ts',
    'src/owned-notifications.ts',
    'src/clipboard-history.ts',
    'src/fs.ts',
    'src/undo.ts',
    'src/audit-log.ts',
    'src/perf-stats.ts',
    'src/grid.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minifySyntax: true,
  target: 'es2022',
  // Preserve consumer PURE metadata as well as public function/class names.
  onSuccess: async () => {
    execFileSync(process.execPath, [resolve('../../scripts/compact-published-js.mjs'), 'dist'], {
      stdio: 'inherit',
    })
  },
})
