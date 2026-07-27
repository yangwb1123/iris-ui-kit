#!/usr/bin/env node

/**
 * checks/self_test.mjs — Self-test for the check modules.
 *
 * Validates that:
 *   1. All check modules can be imported without error
 *   2. Each module exports a `run` function
 *   3. iris.yaml parses correctly
 *
 * Similar to snaplink's checks/self_test.py.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT, load } from './config.mjs'

export async function run() {
  console.log('=== Check System Self-Test ===\n')

  let pass = 0
  let fail = 0

  // 1. Config loads correctly
  try {
    const cfg = getConfig()
    console.log(`✓ iris.yaml loaded: project="${cfg.project.name}" language=${cfg.project.language}`)
    pass++
  } catch (err) {
    console.log(`✗ iris.yaml load failed: ${err.message}`)
    fail++
  }

  // 2. All check modules import cleanly and export run()
  const checkDir = resolve(ROOT, 'checks')
  const checkFiles = readdirSync(checkDir)
    .filter(f => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'config.mjs' && f !== 'self_test.mjs')

  for (const file of checkFiles) {
    try {
      const mod = await import(resolve(checkDir, file))
      if (typeof mod.run === 'function') {
        console.log(`✓ ${file} exports run()`)
        pass++
      } else {
        console.log(`✗ ${file} does not export a run() function`)
        fail++
      }
    } catch (err) {
      console.log(`✗ ${file} import failed: ${err.message}`)
      fail++
    }
  }

  console.log(`\n${'═'.repeat(48)}`)
  console.log(`Self-test: ${pass}/${pass + fail} checks passed`)

  if (fail > 0) {
    console.log(`❌ ${fail} failure(s)\n`)
    return 1
  }

  console.log('✅ All checks pass\n')
  return 0
}