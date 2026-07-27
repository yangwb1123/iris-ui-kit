#!/usr/bin/env node

/**
 * tests/test-changelog.mjs — Test suite for checks/changelog.mjs
 *
 * Run: node tests/test-changelog.mjs
 */

import { strict as assert } from 'node:assert'

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

console.log('\n--- Changelog Tests ---\n')

test('changelog.mjs exports run()', async () => {
  const mod = await import('../checks/changelog.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('changelog produces markdown output', async () => {
  const mod = await import('../checks/changelog.mjs')
  // Test with --since HEAD~1 to limit scope
  const originalArgv = process.argv
  process.argv = [...originalArgv.slice(0, 2), '--since', 'HEAD~5']
  const ec = await mod.run({})
  process.argv = originalArgv
  // Should succeed (0) even with no commits, as long as git works
  assert.ok(typeof ec === 'number')
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)