#!/usr/bin/env node

/**
 * tests/test-architecture.mjs — Test suite for checks/architecture.mjs
 *
 * Run: node tests/test-architecture.mjs
 */

import { strict as assert } from 'node:assert'
import { getConfig } from '../checks/config.mjs'

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

console.log('\n--- Architecture Check Tests ---\n')

test('architecture.mjs exports run()', async () => {
  const mod = await import('../checks/architecture.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('forbidden_imports section is valid', () => {
  const cfg = getConfig()
  const rules = cfg.architecture.forbidden_imports
  assert.ok(Array.isArray(rules))
  assert.ok(rules.length >= 1)

  const coreRule = rules.find(r => r.source === 'packages/core')
  assert.ok(coreRule, 'core rule exists')
  assert.ok(coreRule.forbidden.includes('react'), 'core forbids react')
  assert.ok(coreRule.forbidden.includes('vue'), 'core forbids vue')
  assert.ok(coreRule.forbidden.includes('solid-js'), 'core forbids solid-js')
  assert.ok(coreRule.forbidden.includes('svelte'), 'core forbids svelte')
})

test('plugin_rules exist for plugin-core dirs', () => {
  const cfg = getConfig()
  const pluginRules = cfg.architecture.plugin_rules
  assert.ok(Array.isArray(pluginRules))
  if (pluginRules.length > 0) {
    const rule = pluginRules[0]
    assert.ok(rule.pattern)
    assert.ok(Array.isArray(rule.forbidden))
  }
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)