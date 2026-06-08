import { defineConfig } from 'tsup'

export default defineConfig({
  // `index` = the pure tool logic (library); `server` = the stdio MCP entry.
  entry: { index: 'src/index.ts', server: 'src/server.ts' },
  format: ['esm', 'cjs'],
  dts: { entry: { index: 'src/index.ts' } },
  sourcemap: true,
  clean: true,
  target: 'node18',
  external: ['@modelcontextprotocol/sdk', '@iris-ui/manifest'],
  // Shebang for the bin entry.
  banner: { js: '' },
})
