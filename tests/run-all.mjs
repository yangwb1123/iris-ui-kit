#!/usr/bin/env node

/**
 * tests/run-all.mjs — Run all check system test suites sequentially.
 *
 * Each test file is a self-executing script that calls process.exit().
 * We spawn them as child processes via spawn() to isolate exit codes.
 */

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')
const testFiles = readdirSync(__dirname)
  .filter(f => f.startsWith('test-') && f.endsWith('.mjs') && f !== 'run-all.mjs')
  .sort()

console.log('═'.repeat(48))
console.log('  Iris UI Check System — All Tests')
console.log('═'.repeat(48))
console.log()

let pass = 0
let fail = 0

for (const file of testFiles) {
  const testPath = resolve(__dirname, file)
  const testName = file.replace(/^test-/, '').replace(/\.mjs$/, '')
  process.stdout.write(`  ${testName} ... `)

  const { exitCode } = await new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [testPath], {
      stdio: 'inherit',
      cwd: resolve(__dirname, '..'),
    })
    child.on('close', (code) => resolvePromise({ exitCode: code ?? 1 }))
    child.on('error', () => resolvePromise({ exitCode: 1 }))
  })

  if (exitCode === 0) {
    console.log(`  ✓ PASS\n`)
    pass++
  } else {
    console.log(`  ✗ FAIL\n`)
    fail++
  }
}

console.log('═'.repeat(48))
console.log(`  ${pass}/${pass + fail} test suites passed`)

if (fail > 0) {
  console.log(`\n  ❌ ${fail} test suite(s) failed\n`)
  process.exit(1)
}

console.log('\n  ✅ All tests passed\n')
process.exit(0)