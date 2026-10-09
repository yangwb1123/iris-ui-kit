import { defineConfig } from 'tsup'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  // Post-tree-shake compaction must retain PURE metadata for single-icon imports.
  onSuccess: async () => {
    execFileSync(process.execPath, [resolve('../../scripts/compact-published-js.mjs'), 'dist'], {
      stdio: 'inherit',
    })
  },
})
