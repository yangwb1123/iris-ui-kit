#!/usr/bin/env node
/**
 * Check benchmark regression against baseline.
 * Usage: node scripts/check-bench-regression.mjs [--threshold=0.2]
 *
 * Runs benchmarks, compares against bench-baseline.json, and reports
 * any regressions beyond the threshold (default 20% slower).
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = resolve(ROOT, 'scripts/bench-baseline.json')
const THRESHOLD = parseFloat(process.argv.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? '0.2')

if (!existsSync(BASELINE_PATH)) {
  console.error('Baseline not found. Run with --init to create.')
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))

console.log(`\nBenchmark regression check (threshold: ${THRESHOLD * 100}%)\n`)

// Run benchmarks
const output = execSync('pnpm --filter @iris-ui/core bench', { cwd: ROOT, encoding: 'utf8' })

let failed = 0
let passed = 0

// Parse benchmark output and compare
const lines = output.split('\n')
let currentDescribe = ''
for (const line of lines) {
  // Track describe blocks
  const describeMatch = line.match(/✓ src\/(\w+)\.bench\.ts > (\w+) >/)
  if (describeMatch) {
    currentDescribe = describeMatch[2]
    continue
  }

  // Parse benchmark results
  const benchMatch = line.match(/· (.+?)\s+([\d,.]+) ops\/sec/)
  if (benchMatch) {
    const name = benchMatch[1].trim()
    const ops = parseFloat(benchMatch[2].replace(/,/g, ''))

    // Find baseline
    let baselineOps = null
    for (const [category, benches] of Object.entries(baseline)) {
      if (benches[name] !== undefined) {
        baselineOps = benches[name]
        break
      }
    }

    if (baselineOps !== null) {
      const ratio = ops / baselineOps
      if (ratio < (1 - THRESHOLD)) {
        console.log(`  ❌ ${name}: ${ops} ops/sec (${(ratio * 100).toFixed(0)}% of baseline ${baselineOps})`)
        failed++
      } else if (ratio > (1 + THRESHOLD)) {
        console.log(`  ⚡ ${name}: ${ops} ops/sec (${(ratio * 100).toFixed(0)}% of baseline ${baselineOps})`)
        passed++
      } else {
        console.log(`  ✅ ${name}: ${ops} ops/sec`)
        passed++
      }
    }
  }
}

console.log(`\n${passed + failed} benchmarks checked, ${failed} regressions\n`)
process.exit(failed > 0 ? 1 : 0)
