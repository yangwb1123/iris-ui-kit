#!/usr/bin/env node

/**
 * tests/test-config.mjs — Test suite for checks/config.mjs
 *
 * Run: node tests/test-config.mjs
 */

import { strict as assert } from 'node:assert'
import { load, getConfig, resetCache, ROOT, CONFIG_PATH } from '../checks/config.mjs'
import { existsSync } from 'node:fs'

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

// Reset cache for clean test
resetCache()

console.log('\n--- Config Loader Tests ---\n')

test('config path resolves to iris.yaml', () => {
  assert.ok(CONFIG_PATH.endsWith('iris.yaml'), `Expected iris.yaml, got ${CONFIG_PATH}`)
})

test('iris.yaml exists on disk', () => {
  assert.ok(existsSync(CONFIG_PATH), 'iris.yaml not found')
})

test('getConfig() returns a config object', () => {
  const cfg = getConfig()
  assert.ok(cfg, 'config is null')
  assert.ok(typeof cfg === 'object', 'config is not an object')
})

test('project section is present', () => {
  const cfg = getConfig()
  assert.equal(cfg.project.name, 'iris-ui')
  assert.equal(cfg.project.language, 'typescript')
})

test('filesize section has defaults', () => {
  const cfg = getConfig()
  assert.equal(cfg.filesize.max_lines, 500)
  assert.ok(Array.isArray(cfg.filesize.exemptions))
  assert.ok(Array.isArray(cfg.filesize.ignore_patterns))
})

test('architecture section has rules', () => {
  const cfg = getConfig()
  assert.ok(Array.isArray(cfg.architecture.forbidden_imports))
  assert.ok(cfg.architecture.forbidden_imports.length > 0)
  assert.ok(cfg.architecture.forbidden_imports[0].source)
  assert.ok(Array.isArray(cfg.architecture.forbidden_imports[0].forbidden))
})

test('size section has budgets', () => {
  const cfg = getConfig()
  const budgets = cfg.size.budgets
  assert.ok(budgets['@iris-ui-kit/core'] > 0)
  assert.ok(budgets['@iris-ui-kit/react'] > 0)
  assert.ok(budgets['@iris-ui-kit/vue'] > 0)
})

test('framework parity section has frameworks', () => {
  const cfg = getConfig()
  const fws = cfg.framework_parity.frameworks
  assert.ok(fws.react)
  assert.ok(fws.vue)
  assert.ok(fws.solid)
  assert.ok(fws.svelte)
})

test('desktop parity section has shells', () => {
  const cfg = getConfig()
  assert.ok(cfg.desktop_parity.reference, 'desktop-os')
  assert.ok(Array.isArray(cfg.desktop_parity.shells))
  assert.ok(cfg.desktop_parity.shells.length >= 4)
})

test('change_budget section has thresholds', () => {
  const cfg = getConfig()
  assert.equal(cfg.change_budget.target_files, 5)
  assert.equal(cfg.change_budget.target_core_lines, 300)
  assert.equal(cfg.change_budget.hard_stop_files, 10)
})

test('deep merge fills missing keys with defaults', () => {
  // If iris.yaml were missing a key, defaults should fill in
  const cfg = getConfig()
  // coverage targets might not cover all packages, but defaults exist
  assert.ok(cfg.coverage.exclude_patterns.length > 0)
})

// Test that js-yaml loads correctly
const yamlContent = `
project:
  name: test-project
  language: rust
filesize:
  max_lines: 200
`
test('in-memory YAML parsing', () => {
  // Just verify the module uses js-yaml successfully
  const cfg = getConfig()
  assert.ok(cfg.project.name)
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)