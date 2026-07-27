#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const modes = {
  manifest: {
    script: 'gen:manifest',
    files: ['packages/manifest/manifest.json', 'packages/manifest/llms.txt'],
  },
  docs: {
    script: 'gen:docs-reference',
    files: [
      'apps/docs/components.md',
      'apps/docs/.vitepress/theme/iris-tokens.css',
      'apps/docs/.vitepress/theme/explorer-data.ts',
    ],
  },
}

const mode = process.argv[2]
const config = modes[mode]
if (!config) {
  process.stderr.write(`Usage: node scripts/check-generated.mjs ${Object.keys(modes).join('|')}\n`)
  process.exit(1)
}

const snapshot = (path) => (existsSync(path) ? readFileSync(path) : undefined)
const before = new Map(
  config.files.map((file) => {
    const path = resolve(root, file)
    return [file, snapshot(path)]
  }),
)
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const generated = spawnSync(pnpm, [config.script], { cwd: root, stdio: 'inherit' })
if (generated.status !== 0) process.exit(generated.status ?? 1)

const changed = config.files.filter((file) => {
  const previous = before.get(file)
  const current = snapshot(resolve(root, file))
  return previous === undefined || current === undefined || !previous.equals(current)
})
if (changed.length > 0) {
  process.stderr.write(
    `${mode} generated output was stale:\n${changed.map((file) => `- ${file}`).join('\n')}\n`,
  )
  process.exit(1)
}
process.stdout.write(`${mode} generated output is up to date (${config.files.length} files).\n`)
