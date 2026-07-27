#!/usr/bin/env node

/**
 * tests/test-rsc.mjs — Test suite for checks/rsc.mjs
 *
 * Run: node tests/test-rsc.mjs
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

console.log('\n--- RSC Directive Tests ---\n')

test('rsc.mjs exports run()', async () => {
  const mod = await import('../checks/rsc.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('config has rsc section', () => {
  const cfg = getConfig()
  assert.ok(cfg.rsc.check_dir, 'check_dir should be defined')
  assert.ok(cfg.rsc.framework_name, 'framework_name should be defined')
  assert.equal(cfg.rsc.framework_name, 'react')
})

test('rsc check_dir points to react dist', () => {
  const cfg = getConfig()
  const checkDir = cfg.rsc.check_dir
  assert.ok(checkDir.includes('react'), 'check_dir should point to react')
})

test('react dist directory exists (if built)', () => {
  const cfg = getConfig()
  const checkPath = resolve(ROOT, cfg.rsc.check_dir)
  if (existsSync(checkPath)) {
    console.log(`  ✓ react dist found at ${cfg.rsc.check_dir}`)
  } else {
    console.log(`  ℹ️  react dist not found (run build first)`)
  }
})

test('rsc check excludes node_modules', () => {
  const cfg = getConfig()
  const ignore = cfg.filesize.ignore_patterns || []
  assert.ok(ignore.some(p => p.includes('node_modules')), 'should ignore node_modules')
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)