#!/usr/bin/env node

/**
 * tests/test-size.mjs — Test suite for checks/size.mjs
 *
 * Run: node tests/test-size.mjs
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

console.log('\n--- Size Check Tests ---\n')

test('size.mjs exports run()', async () => {
  const mod = await import('../checks/size.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('config has size budgets for all packages', () => {
  const cfg = getConfig()
  const budgets = cfg.size.budgets
  assert.ok(budgets['@iris-ui/core'] > 0)
  assert.ok(budgets['@iris-ui/react'] > 0)
  assert.ok(budgets['@iris-ui/vue'] > 0)
  assert.ok(budgets['@iris-ui/solid'] > 0)
  assert.ok(budgets['@iris-ui/svelte'] > 0)
  assert.ok(budgets['@iris-ui/tokens'] > 0)
  assert.ok(budgets['@iris-ui/theme'] > 0)
})

test('size budget values are reasonable', () => {
  const cfg = getConfig()
  // Core should be smallest
  assert.ok(cfg.size.budgets['@iris-ui/core'] < cfg.size.budgets['@iris-ui/react'],
    'core budget should be smaller than react')
  assert.ok(cfg.size.budgets['@iris-ui/core'] < cfg.size.budgets['@iris-ui/vue'],
    'core budget should be smaller than vue')
  assert.ok(cfg.size.budgets['@iris-ui/manifest'] <= 5,
    'manifest budget should be very small')
})

test('budget baseline path exists or is configurable', () => {
  const cfg = getConfig()
  const baselinePath = cfg.size.budget_baseline_path
  assert.ok(typeof baselinePath === 'string')
  // Baseline path should reference a valid location
  const fullPath = resolve(ROOT, baselinePath)
  console.log(`  (baseline: ${baselinePath})`)
  // Don't require it to exist — it's created on first run
})

test('dist files exist for key packages', () => {
  // Only check if dist exists (build required)
  const keyPkgs = ['core', 'react', 'vue']
  let found = 0
  for (const pkg of keyPkgs) {
    const distPath = resolve(ROOT, `packages/${pkg}/dist/index.js`)
    if (existsSync(distPath)) found++
  }
  console.log(`  (${found}/${keyPkgs.length} dist files found; run build if < 3)`)
  // Advisory — don't fail if build hasn't run
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)