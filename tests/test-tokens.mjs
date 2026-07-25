#!/usr/bin/env node

/**
 * tests/test-tokens.mjs — Test suite for checks/tokens.mjs
 *
 * Run: node tests/test-tokens.mjs
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

console.log('\n--- Token Audit Tests ---\n')

test('tokens.mjs exports run()', async () => {
  const mod = await import('../checks/tokens.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('tokens config has required fields', () => {
  const cfg = getConfig()
  assert.ok(cfg.tokens.tokens_dir, 'tokens_dir should exist')
  assert.ok(cfg.tokens.token_source_files, 'token_source_files should exist')
  assert.ok(Array.isArray(cfg.tokens.token_source_files))
})

test('token source directory exists', () => {
  const cfg = getConfig()
  const dir = resolve(ROOT, cfg.tokens.tokens_dir)
  assert.ok(existsSync(dir), `tokens dir should exist: ${dir}`)
})

test('token source files exist', () => {
  const cfg = getConfig()
  for (const file of cfg.tokens.token_source_files) {
    const fullPath = resolve(ROOT, cfg.tokens.tokens_dir, file)
    assert.ok(existsSync(fullPath), `token file should exist: ${file}`)
  }
})

test('tokens directory is at expected path', () => {
  const cfg = getConfig()
  assert.ok(cfg.tokens.tokens_dir.includes('tokens'), 'tokens_dir should contain tokens')
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)