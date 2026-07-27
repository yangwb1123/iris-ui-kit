#!/usr/bin/env node
/**
 * Check benchmark regression against baseline.
 * Runs benchmarks, parses hz values, compares to baseline, saves history.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = resolve(ROOT, 'scripts/bench-baseline.json')
const HISTORY_PATH = resolve(ROOT, 'scripts/bench-history.json')
const THRESHOLD = parseFloat(process.argv.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? '0.2')

if (!existsSync(BASELINE_PATH)) {
  console.log('Baseline not found.')
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))

console.log(`\nBenchmark regression check (threshold: ${THRESHOLD * 100}%)\n`)

// Run benchmarks
const result = spawnSync('pnpm', ['--filter', '@iris-ui-kit/core', 'bench'], {
  cwd: ROOT,
  encoding: 'buffer',
  stdio: ['pipe', 'pipe', 'pipe'],
})

const text = result.stdout.toString('utf8')

// Parse all bench results: [name, ops]
const benches = []
for (const line of text.split('\n')) {
  const clean = line.replace(/\u001b\[[0-9;]*m/g, '').trim()
  if (!clean || clean.startsWith('name') || clean.startsWith('···')) continue
  const m = clean.match(/^[·•\-\s]+(.+?)\s+([\d,]+(?:\.\d+)?)\s+[\d,]+/)
  if (!m) continue
  const name = m[1].trim()
  const ops = parseFloat(m[2].replace(/,/g, ''))
  if (name && !isNaN(ops)) benches.push({ name, ops })
}

// Compare against baseline
let failed = 0, passed = 0
for (const { name, ops } of benches) {
  let baselineOps = null
  for (const [, benchesObj] of Object.entries(baseline)) {
    if (benchesObj[name] !== undefined) {
      baselineOps = benchesObj[name]
      break
    }
  }

  if (baselineOps === null) {
    console.log(`  ➖ ${name}: ${ops} ops/sec`)
    continue
  }

  const ratio = ops / baselineOps
  if (ratio < (1 - THRESHOLD)) {
    console.log(`  ❌ ${name}: ${ops} ops/sec (${(ratio * 100).toFixed(0)}% of ${baselineOps})`)
    failed++
  } else if (ratio > (1 + THRESHOLD)) {
    console.log(`  ⚡ ${name}: ${ops} ops/sec (${(ratio * 100).toFixed(0)}% of ${baselineOps})`)
    passed++
  } else {
    console.log(`  ✅ ${name}: ${ops} ops/sec`)
    passed++
  }
}

// Save history for trend tracking
const history =
  existsSync(HISTORY_PATH) ? JSON.parse(readFileSync(HISTORY_PATH, 'utf8')) : {}
const today = new Date().toISOString().slice(0, 10)
if (!history[today]) {
  history[today] = { timestamp: today, results: {} }
}
for (const { name, ops } of benches) {
  history[today].results[name] = ops
}
writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n')

console.log(`\n${passed} ok, ${failed} regressions out of ${passed + failed}\n`)
process.exit(failed > 0 ? 1 : 0)
