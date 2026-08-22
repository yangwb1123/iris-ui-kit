import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageSource = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

function subpathAliases(pkg: string, bare: string): Record<string, string> {
  const aliases: Record<string, string> = {}
  const sourceDir = fileURLToPath(new URL(`../../packages/${pkg}/src`, import.meta.url))
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(sourceDir, entry.name, 'index.ts'))) {
      aliases[`${bare}/${entry.name}`] = join(sourceDir, entry.name, 'index.ts')
    }
  }
  return aliases
}

function fileSubpathAliases(pkg: string, bare: string): Record<string, string> {
  const aliases: Record<string, string> = {}
  const sourceDir = fileURLToPath(new URL(`../../packages/${pkg}/src`, import.meta.url))
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      aliases[`${bare}/${entry.name.slice(0, -3)}`] = join(sourceDir, entry.name)
    }
  }
  return aliases
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5180, strictPort: true },
  resolve:
    command === 'serve'
      ? {
          alias: {
            ...subpathAliases('core', '@iris-ui-kit/core'),
            ...fileSubpathAliases('core', '@iris-ui-kit/core'),
            '@iris-ui-kit/core': packageSource('core'),
            '@iris-ui-kit/tokens': packageSource('tokens'),
            '@iris-ui-kit/theme': packageSource('theme'),
            '@iris-ui-kit/skins': packageSource('skins'),
            '@iris-ui-kit/icons': packageSource('icons'),
            ...subpathAliases('react', '@iris-ui-kit/react'),
            '@iris-ui-kit/react': packageSource('react'),
            '@iris-ui-kit/plugin-locale-zh/core': fileURLToPath(
              new URL('../../packages/plugin-locale-zh/src/core/index.ts', import.meta.url),
            ),
          },
        }
      : {},
  test: { environment: 'jsdom' },
}))
