import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { compactJavaScript } from '../compact-published-js.mjs'

const require = createRequire(import.meta.url)
const esbuild = createRequire(require.resolve('tsup'))('esbuild')
test('Turbo invalidates shared compactor inputs instead of restoring stale publication bytes', () => {
  const text = readFileSync(new URL('../../turbo.json', import.meta.url), 'utf8')
  const parsed = require('typescript').parseConfigFileTextToJson('turbo.json', text)
  assert.equal(parsed.error, undefined)
  assert.ok(parsed.config.globalDependencies.includes('scripts/compact-published-js.mjs'))
})

const cjsSource = `'use strict';
this.marker = 'cjs exports';
class PublicCjs {
  constructor(value, unused) { this.value = value; }
  read(unused) { return this.value; }
}
function publicHelper(value, unused) { return value + 1; }
function strictProbe() { return this === undefined; }
Object.assign(exports, { PublicCjs, publicHelper, strictProbe });`

function evaluateCjs(code) {
  const module = { exports: {} }
  new Function('exports', 'module', code).call(module.exports, module.exports, module)
  return module.exports
}

test('CJS retains strictness, top-level exports this, public names and unused-argument arity', async () => {
  const before = evaluateCjs(cjsSource)
  const { code } = await compactJavaScript(cjsSource, 'fixture.cjs')
  const after = evaluateCjs(code)
  assert.deepEqual(Object.keys(after), Object.keys(before))
  assert.equal(after.marker, before.marker)
  for (const key of ['PublicCjs', 'publicHelper', 'strictProbe']) {
    assert.equal(after[key].name, before[key].name)
    assert.equal(after[key].length, before[key].length)
  }
  assert.equal(after.PublicCjs.prototype.read.length, before.PublicCjs.prototype.read.length)
  assert.equal(new after.PublicCjs(7).read(), 7)
  assert.equal(after.publicHelper(7), 8)
  assert.equal(after.strictProbe.call(undefined), true)
  assert.match(code, /^['"]use strict['"]/)
})

test('unsupported or inconsistent source maps fail rather than being relabeled as valid v3 maps', async () => {
  const base = { version: 3, sources: ['original.ts'], names: [], mappings: 'AAAA' }
  for (const map of [
    { ...base, version: 2 },
    { ...base, sources: [42] },
    { ...base, sourcesContent: [] },
    { ...base, sourcesContent: [42] },
  ]) {
    await assert.rejects(
      compactJavaScript('export const value = 1', 'fixture.js', JSON.stringify(map)),
      /source map/,
    )
  }
})

test('repeated compaction retains original maps and names without duplicating map directives', async () => {
  const source = `'use client'; export function publicHelper(value, unused) { return value + 1; }`
  const built = await esbuild.transform(source, {
    sourcefile: 'original.ts',
    sourcemap: 'external',
    format: 'esm',
  })
  const first = await compactJavaScript(built.code, 'fixture.js', built.map)
  const second = await compactJavaScript(first.code, 'fixture.js', first.map)
  const map = JSON.parse(second.map)
  assert.deepEqual(map.sources, ['original.ts'])
  assert.deepEqual(map.sourcesContent, [source])
  assert.ok(map.mappings.length)
  assert.equal((second.code.match(/sourceMappingURL=/g) ?? []).length, 1)
  assert.match(second.code, /^['"]use client['"]/)
  const mod = await import(
    'data:text/javascript;base64,' + Buffer.from(second.code).toString('base64')
  )
  assert.equal(mod.publicHelper.name, 'publicHelper')
  assert.equal(mod.publicHelper.length, 2)
  assert.equal(mod.publicHelper(7), 8)
})
