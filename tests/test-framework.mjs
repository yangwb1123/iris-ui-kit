#!/usr/bin/env node

/**
 * tests/test-framework.mjs — Test suite for checks/framework-parity.mjs
 *
 * Run: node tests/test-framework.mjs
 */

import { strict as assert } from 'node:assert'
import { resolve } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
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

console.log('\n--- Framework Parity Tests ---\n')

test('framework-parity.mjs exports run()', async () => {
  const mod = await import('../checks/framework-parity.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('config has all 4 frameworks', () => {
  const cfg = getConfig()
  const fws = cfg.framework_parity.frameworks
  assert.ok(fws.react, 'react')
  assert.ok(fws.vue, 'vue')
  assert.ok(fws.solid, 'solid')
  assert.ok(fws.svelte, 'svelte')
})

test('all framework directories exist on disk', () => {
  const cfg = getConfig()
  for (const [name, dir] of Object.entries(cfg.framework_parity.frameworks)) {
    const fullPath = resolve(ROOT, dir)
    assert.ok(existsSync(fullPath), `${name} primitives dir should exist`)
    const entries = readdirSync(fullPath, { withFileTypes: true }).filter(e => e.isDirectory())
    assert.ok(entries.length >= 80, `${name} should have >= 80 component dirs (has ${entries.length})`)
  }
})

test('required sub-paths are valid', () => {
  const cfg = getConfig()
  const subs = cfg.framework_parity.required_sub_paths
  assert.ok(Array.isArray(subs))
  assert.ok(subs.length >= 5)
  for (const sub of subs) {
    assert.ok(sub.startsWith('/'), `${sub} should start with /`)
  }
})

test('exemptions config is valid', () => {
  const cfg = getConfig()
  const ex = cfg.framework_parity.directory_exemptions || {}
  // floating is exempted for vue
  assert.ok(ex.floating, 'floating exemption should exist')
  assert.ok(ex.floating.includes('vue'), 'vue should be exempt for floating')
  // modal-utils is exempted for vue and svelte
  assert.ok(ex['modal-utils'], 'modal-utils exemption should exist')
  assert.ok(ex['modal-utils'].includes('vue'), 'vue should be exempt for modal-utils')
  assert.ok(ex['modal-utils'].includes('svelte'), 'svelte should be exempt for modal-utils')
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)