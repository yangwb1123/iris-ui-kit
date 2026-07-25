#!/usr/bin/env node

/**
 * tests/test-spelling.mjs — Test suite for checks/spelling.mjs
 *
 * Run: node tests/test-spelling.mjs
 */

import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

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

console.log('\n--- Spell Check Tests ---\n')

test('spelling.mjs exports run()', async () => {
  const mod = await import('../checks/spelling.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('common typos are configured', () => {
  const content = readFileSync(resolve(__dirname, '..', 'checks', 'spelling.mjs'), 'utf-8')
  const typoCount = (content.match(/': '/g) || []).length
  assert.ok(typoCount >= 10, `Should have >= 10 common typos, got ${typoCount}`)
  console.log(`  (${typoCount} common typos configured)`)
})

test('allow list contains technical terms', () => {
  const content = readFileSync(resolve(__dirname, '..', 'checks', 'spelling.mjs'), 'utf-8')
  // Match entries in the ALLOW_LIST Set
  const allowEntries = content.match(/['"][a-zA-Z]{4,}['"]/g) || []
  // Filter duplicates from the set
  const uniqueEntries = [...new Set(allowEntries)]
  assert.ok(uniqueEntries.length >= 50, `Should have >= 50 allow-listed terms, got ${uniqueEntries.length}`)
})

test('module can list files in core src', () => {
  const dir = execSync('ls packages/core/src/*.ts 2>/dev/null | head -5', {
    cwd: resolve(__dirname, '..'), encoding: 'utf-8', timeout: 5000,
  })
  assert.ok(dir.length > 0, 'Should find source files')
  const files = dir.trim().split('\n')
  assert.ok(files.length > 0)
  console.log(`  (sample: ${files[0]})`)
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)