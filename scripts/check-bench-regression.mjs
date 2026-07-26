#!/usr/bin/env node
/**
 * Check benchmark regression against baseline.
 * Runs benchmarks, parses hz values, compares to baseline.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = resolve(ROOT, 'scripts/bench-baseline.json')
const THRESHOLD = parseFloat(process.argv.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? '0.2')

if (!existsSync(BASELINE_PATH)) {
  console.log('Baseline not found.')
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))

console.log(`\nBenchmark regression check (threshold: ${THRESHOLD * 100}%)\n`)

// Run benchmarks and capture all output as buffer
const result = spawnSync('pnpm', ['--filter', '@iris-ui/core', 'bench'], {
  cwd: ROOT,
  encoding: 'buffer',
  stdio: ['pipe', 'pipe', 'pipe'],
})

const text = result.stdout.toString('utf8')

// Parse lines with hz values
// The format is: bullet + bench_name + number_with_commas + number + number + ...
// where the first number after the name is the hz (ops/sec)
let failed = 0, passed = 0

for (const line of text.split('\n')) {
  // Remove ANSI escape sequences
  const ansiStrip = line.replace(/\u001b\[[0-9;]*m/g, '').trim()
  if (!ansiStrip || ansiStrip.startsWith('name') || ansiStrip.startsWith('···')) continue

  // Look for: bullet-like character + name + number
  const m = ansiStrip.match(/^[·•\-\s]+(.+?)\s+([\d,]+(?:\.\d+)?)\s+[\d,]+/)
  if (!m) continue

  const name = m[1].trim()
  const ops = parseFloat(m[2].replace(/,/g, ''))
  if (!name || isNaN(ops)) continue

  // Find in baseline
  let baselineOps = null
  for (const [, benches] of Object.entries(baseline)) {
    if (benches[name] !== undefined) { baselineOps = benches[name]; break }
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

console.log(`\n${passed} ok, ${failed} regressions out of ${passed + failed}\n`)
process.exit(failed > 0 ? 1 : 0)
