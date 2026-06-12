import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  sourcemap: true,
  clean: true,
  target: 'node18',
  external: ['@iris-ui/manifest'],
  // Inject the shebang so the bin entry is executable.
  banner: { js: '#!/usr/bin/env node' },
})
