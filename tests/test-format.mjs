#!/usr/bin/env node

/**
 * tests/test-format.mjs — Test suite for checks/format.mjs
 *
 * Run: node tests/test-format.mjs
 */

import { strict as assert } from 'node:assert'
import { execSync } from 'node:child_process'

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

console.log('\n--- Format Check Tests ---\n')

test('format.mjs exports run()', async () => {
  const mod = await import('../checks/format.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('prettier is available', () => {
  const version = execSync('npx prettier --version', { encoding: 'utf-8', timeout: 5000 }).trim()
  assert.ok(version.length > 0, `Prettier version: ${version}`)
  console.log(`  (Prettier ${version})`)
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)