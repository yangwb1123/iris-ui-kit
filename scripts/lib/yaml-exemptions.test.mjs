/**
 * The 500-line rule is enforced by two gates (cli.mjs check-filesize and
 * arch-check). They must read the SAME exemption list, or a file can be
 * "exempt" for one and "newly over the limit" for the other — a disagreement
 * that reads like a regression.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFilesizeExemptions, parseFilesizeExemptions } from './yaml-exemptions.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('parses only the filesize exemption list', () => {
  const yaml = [
    'project:',
    '  name: iris-ui',
    'filesize:',
    '  max_lines: 500',
    '  exemptions:',
    '    - packages/core/src/index.ts',
    '    - packages/react/src/primitives/table/Table.tsx',
    'complexity:',
    '  exemptions:',
    '    - should/not/appear.ts',
  ].join('\n')
  const exempt = parseFilesizeExemptions(yaml)
  assert.equal(exempt.size, 2)
  assert.ok(exempt.has('packages/core/src/index.ts'))
  assert.ok(exempt.has('packages/react/src/primitives/table/Table.tsx'))
  assert.equal(exempt.has('should/not/appear.ts'), false)
})

test('a missing or unrelated iris.yaml exempts nothing (fail closed)', () => {
  assert.equal(parseFilesizeExemptions('').size, 0)
  assert.equal(parseFilesizeExemptions('project:\n  name: x\n').size, 0)
})

test('the real iris.yaml list is non-empty and contains the grid bridge', () => {
  const exempt = loadFilesizeExemptions(root)
  assert.ok(exempt.size > 10, `expected a populated exemption list, got ${exempt.size}`)
  assert.ok(exempt.has('packages/core/src/index.ts'))
  // The grid bridge files were added explicitly (with a reason) in 2026-09-28.
  assert.ok(exempt.has('packages/vue/src/grid/index.ts'))
  assert.ok(exempt.has('packages/solid/src/grid/index.ts'))
})

test('every exempted path exists on disk (a typo would silently exempt nothing)', () => {
  const exempt = loadFilesizeExemptions(root)
  const missing = [...exempt].filter((rel) => {
    try {
      readFileSync(resolve(root, rel))
      return false
    } catch {
      return true
    }
  })
  assert.deepEqual(missing, [])
})
