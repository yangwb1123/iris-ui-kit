import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { test } from 'node:test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const script = readFileSync(join(root, 'scripts/check-size.mjs'), 'utf8')
const entries = [
  'core',
  'tokens',
  'theme',
  'skins',
  'icons',
  'react',
  'vue',
  'solid',
  'svelte',
  'manifest',
]
const plugins = [
  'admin',
  'calendar',
  'charts',
  'dashboard',
  'editor',
  'form-builder',
  'kanban',
  'locale-zh',
  'markdown',
  'notifications',
  'pro-table',
  'query-builder',
]

function noise() {
  let state = 42
  const bytes = Buffer.alloc(160000)
  for (let i = 0; i < bytes.length; i++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    bytes[i] = state & 255
  }
  return `\n/*${bytes.toString('base64')}*/\n`
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'iris-size-policy-'))
  mkdirSync(join(dir, 'scripts/lib'), { recursive: true })
  writeFileSync(join(dir, 'scripts/check-size.mjs'), script)
  writeFileSync(
    join(dir, 'scripts/lib/esbuild-binary.mjs'),
    readFileSync(join(root, 'scripts/lib/esbuild-binary.mjs')),
  )
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}')
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
  for (const name of [...entries, ...plugins.map((name) => `plugin-${name}`)]) {
    mkdirSync(join(dir, 'packages', name, 'dist'), { recursive: true })
    writeFileSync(join(dir, 'packages', name, 'package.json'), '{"type":"module"}')
    writeFileSync(
      join(dir, 'packages', name, 'dist/index.js'),
      'export const defaultIcons = { icons: {} }; export const chevronDown = {}; export const IrisButton = 1; export function useForm() {}\n',
    )
  }
  return dir
}

function run(dir) {
  const result = spawnSync(process.execPath, [join(dir, 'scripts/check-size.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 128 * 1024,
  })
  assert.ifError(result.error)
  return result
}

test('authorized size limits agree with YAML and retain the single-icon hard gate', () => {
  const yaml = readFileSync(join(root, 'iris.yaml'), 'utf8')
  assert.match(script, /core: 72,/)
  assert.match(script, /icons: 12,/)
  assert.match(yaml, /"@iris-ui-kit\/core": 72/)
  assert.match(yaml, /"@iris-ui-kit\/icons": 12/)
  assert.match(script, /name: 'icons: import \{ chevronDown \}[^]*?budgetKb: 1,\s*enforce: true/)
})

for (const [name, limit] of [
  ['core', 72],
  ['icons', 12],
]) {
  test(`${name} still fails the real CLI above the finite entry-gzip limit`, () => {
    const dir = fixture()
    try {
      assert.equal(run(dir).status, 0, 'the complete small fixture must first pass')
      const entry = join(dir, 'packages', name, 'dist/index.js')
      const code = readFileSync(entry, 'utf8') + noise()
      assert.ok(gzipSync(code).byteLength > limit * 1024)
      writeFileSync(entry, code)
      const result = run(dir)
      assert.equal(result.status, 1)
      assert.match(result.stdout, new RegExp(`@iris-ui-kit/${name}\\s+OVER`))
      assert.match(result.stderr, /size budget exceeded/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
