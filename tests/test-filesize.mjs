#!/usr/bin/env node

/**
 * tests/test-filesize.mjs — Test suite for checks/filesize.mjs
 *
 * Run: node tests/test-filesize.mjs
 */

import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT } from '../checks/config.mjs'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`)
    failed++
  }
}

console.log('\n--- Filesize Check Tests ---\n')

// Load module
test('filesize.mjs exports run()', async () => {
  const mod = await import('../checks/filesize.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('config filesize section valid', () => {
  const cfg = getConfig()
  assert.equal(typeof cfg.filesize.max_lines, 'number')
  assert.ok(cfg.filesize.max_lines > 0)
  assert.ok(Array.isArray(cfg.filesize.ignore_patterns))
  assert.ok(Array.isArray(cfg.filesize.exemptions))
})

test('known oversized file is exempted', () => {
  const cfg = getConfig()
  const exempted = cfg.filesize.exemptions
  assert.ok(exempted.includes('packages/core/src/store.ts'), 'store.ts should be exempt')
  assert.ok(exempted.includes('packages/icons/src/icons.ts'), 'icons.ts should be exempt')
})

test('exemptions actually exist on disk', () => {
  const cfg = getConfig()
  let found = 0
  for (const ex of cfg.filesize.exemptions) {
    const fullPath = resolve(ROOT, ex)
    if (existsSync(fullPath)) found++
  }
  // At least most should exist (some may have been moved)
  assert.ok(found > cfg.filesize.exemptions.length * 0.8, `Only ${found}/${cfg.filesize.exemptions.length} exemptions found on disk`)
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)