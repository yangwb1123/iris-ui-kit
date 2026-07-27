#!/usr/bin/env node

/**
 * tests/test-validate-config.mjs — Test suite for checks/validate-config.mjs
 *
 * Run: node tests/test-validate-config.mjs
 */

import { strict as assert } from 'node:assert'
import { getConfig, CONFIG_PATH } from '../checks/config.mjs'
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

console.log('\n--- Config Validation Tests ---\n')

test('validate-config.mjs exports run()', async () => {
  const mod = await import('../checks/validate-config.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('iris.yaml exists', () => {
  assert.ok(existsSync(CONFIG_PATH), 'iris.yaml should exist')
})

test('all required sections have correct types', () => {
  const cfg = getConfig()

  // project
  assert.equal(typeof cfg.project.name, 'string')
  assert.equal(typeof cfg.project.language, 'string')

  // filesize
  assert.equal(typeof cfg.filesize.max_lines, 'number')
  assert.ok(Array.isArray(cfg.filesize.exemptions))
  assert.ok(Array.isArray(cfg.filesize.ignore_patterns))

  // architecture
  assert.ok(Array.isArray(cfg.architecture.forbidden_imports))

  // complexity
  assert.equal(typeof cfg.complexity.max_function_lines, 'number')
  assert.equal(typeof cfg.complexity.max_cyclomatic, 'number')
  assert.equal(typeof cfg.complexity.max_export_symbols, 'number')

  // size
  assert.equal(typeof cfg.size.budgets, 'object')

  // change_budget
  assert.equal(typeof cfg.change_budget.target_files, 'number')
  assert.equal(typeof cfg.change_budget.hard_stop_files, 'number')

  // manifest
  assert.equal(typeof cfg.manifest.manifest_path, 'string')
  assert.equal(typeof cfg.manifest.llms_path, 'string')

  // desktop_parity
  assert.ok(Array.isArray(cfg.desktop_parity.shells))
  assert.equal(typeof cfg.desktop_parity.reference, 'string')
})

test('size budgets cover all packages', () => {
  const cfg = getConfig()
  const required = ['@iris-ui-kit/core', '@iris-ui-kit/react', '@iris-ui-kit/vue', '@iris-ui-kit/solid', '@iris-ui-kit/svelte']
  for (const pkg of required) {
    assert.ok(cfg.size.budgets[pkg] !== undefined, `${pkg} should have a budget`)
    assert.equal(typeof cfg.size.budgets[pkg], 'number')
    assert.ok(cfg.size.budgets[pkg] > 0, `${pkg} budget should be > 0`)
  }
})

test('coverage targets exist for key packages', () => {
  const cfg = getConfig()
  assert.ok(cfg.coverage.targets['@iris-ui-kit/core'] >= 0)
  assert.ok(cfg.coverage.targets['@iris-ui-kit/react'] >= 0)
})

test('framework parity has at least 4 required sub-paths', () => {
  const cfg = getConfig()
  assert.ok(cfg.framework_parity.required_sub_paths.length >= 4)
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)