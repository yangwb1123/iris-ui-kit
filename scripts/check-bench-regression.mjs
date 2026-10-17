#!/usr/bin/env node
/** Own one complete workspace benchmark execution and its fail-closed verdict. */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  baselineEntries,
  parseBenchmarks,
  readJsonFile,
  runWorkspaceBench,
  saveHistory,
  thresholdFromArgs,
  validateHistory,
  withHistoryLock,
} from './lib/bench-regression.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HISTORY = resolve(ROOT, 'scripts/bench-history.json')

function compare(rows, baseline, threshold) {
  let failed = 0
  for (const [name, ops] of rows) {
    const target = baseline.get(name)?.ops
    if (target === undefined) {
      console.log(`  ➖ ${name}: ${ops} ops/sec (no baseline; not acceptance)`)
      continue
    }
    const regression = ops < target * (1 - threshold)
    if (regression) failed++
    console.log(
      `  ${regression ? '❌' : '✅'} ${name}: ${ops} ops/sec (${((ops / target) * 100).toFixed(0)}% of ${target})`,
    )
  }
  return failed
}

async function main() {
  const threshold = thresholdFromArgs(process.argv.slice(2))
  const baseline = baselineEntries(readJsonFile(resolve(ROOT, 'scripts/bench-baseline.json')))
  return withHistoryLock(HISTORY, () => measure(baseline, threshold))
}

async function measure(baseline, threshold) {
  const history = validateHistory(readJsonFile(HISTORY, true))
  console.log(
    `\nBenchmark regression check (threshold: ${threshold * 100}%; one workspace execution)\n`,
  )
  const result = await runWorkspaceBench(ROOT)
  if (result.error || result.status !== 0 || result.signal) {
    process.stderr.write(result.stdout.subarray(-8192))
    process.stderr.write(result.stderr.subarray(-8192))
    throw new Error(
      `Benchmark execution failed: ${result.error?.message ?? result.signal ?? result.status}`,
    )
  }
  // Retain the producer output. It is evidence, never an authorization or PASS.
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  const rows = parseBenchmarks(
    result.stdout.toString('utf8'),
    baseline,
    resolve(ROOT, 'packages/core'),
  )
  const failed = compare(rows, baseline, threshold)
  saveHistory(HISTORY, history, rows)
  console.log(`\n${baseline.size - failed} ok, ${failed} regressions out of ${baseline.size}\n`)
  return failed ? 1 : 0
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error(`Benchmark gate refused: ${error.message}`)
  process.exitCode = 2
}
