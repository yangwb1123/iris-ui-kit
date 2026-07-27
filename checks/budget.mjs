#!/usr/bin/env node

/**
 * checks/budget.mjs — Size budget trend visualization.
 *
 * Tracks gzipped bundle sizes over time, storing historical measurements
 * in a JSON file. Shows trend lines and alerts on budget breaches.
 *
 * Usage: node cli.mjs budget [--record] [--history]
 *   --record    Measure and record current sizes
 *   --history   Show historical trend
 *   Default:    Show current sizes vs budgets
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { getConfig, ROOT } from './config.mjs'

const HISTORY_PATH = resolve(ROOT, 'scripts/size-history.json')

function getPkgDir(pkgName) {
  return pkgName.replace(/^@iris-ui-kit\//, '')
}

function measureSize(pkgDir) {
  try {
    const distPath = resolve(ROOT, `packages/${pkgDir}/dist/index.js`)
    if (!existsSync(distPath)) return null
    const content = readFileSync(distPath)
    const gzipped = gzipSync(content)
    return gzipped.length / 1024
  } catch { return null }
}

export async function run(opts = {}) {
  const args = process.argv.slice(3)
  const recordMode = args.includes('--record')
  const historyMode = args.includes('--history')

  const cfg = getConfig()
  const budgets = cfg.size.budgets
  const now = new Date().toISOString().slice(0, 10)

  // Load history
  let history = []
  if (existsSync(HISTORY_PATH)) {
    try { history = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')) }
    catch { history = [] }
  }

  if (recordMode) {
    // Measure and record current sizes
    const snapshot = { date: now, sizes: {} }
    let recorded = 0

    for (const [pkg, budget] of Object.entries(budgets)) {
      const dir = getPkgDir(pkg)
      const size = measureSize(dir)
      if (size !== null) {
        snapshot.sizes[pkg] = Math.round(size * 100) / 100
        recorded++
      }
    }

    // Dedupe by date (update today's entry if exists)
    const existingIdx = history.findIndex(h => h.date === now)
    if (existingIdx >= 0) {
      history[existingIdx] = snapshot
    } else {
      history.push(snapshot)
    }

    // Keep last 90 days
    if (history.length > 90) history = history.slice(-90)

    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2))
    console.log(`Recorded ${recorded} package sizes for ${now}\n`)
    return 0
  }

  // Display current vs budget
  console.log('═'.repeat(60))
  console.log('  Size Budget Dashboard')
  console.log('═'.repeat(60))
  console.log()

  console.log('  Package'.padEnd(28) + 'Current'.padEnd(10) + 'Budget'.padEnd(10) + 'Status')
  console.log('  ' + '─'.repeat(56))

  let overBudget = 0
  const currentSizes = {}

  for (const [pkg, budget] of Object.entries(budgets)) {
    const dir = getPkgDir(pkg)
    const size = measureSize(dir)

    if (size === null) {
      console.log(`  ${pkg.padEnd(26)} ${'(no dist)'.padEnd(20)}`)
      continue
    }

    currentSizes[pkg] = size
    const pct = ((size / budget) * 100).toFixed(0)
    const bar = '█'.repeat(Math.min(Math.floor(pct / 5), 20))
    const mark = size <= budget ? '✓' : '✗'
    if (size > budget) overBudget++

    console.log(`  ${pkg.padEnd(26)} ${String(size.toFixed(1)).padStart(6)}KB ${String(budget).padStart(5)}KB ${bar} ${pct}% ${mark}`)
  }

  console.log()
  console.log(`  ${Object.keys(currentSizes).length} packages measured, ${overBudget} over budget`)

  // History trend
  if (historyMode && history.length > 1) {
    console.log('\n  ── Historical Trend ──\n')
    const dates = history.map(h => h.date)
    const keyPkgs = Object.keys(currentSizes)

    for (const pkg of keyPkgs) {
      const values = history.map(h => h.sizes[pkg]).filter(v => v !== undefined)
      if (values.length < 2) continue

      const first = values[0]
      const last = values[values.length - 1]
      const trend = ((last - first) / first * 100).toFixed(1)
      const arrow = trend.startsWith('-') ? '↓' : '↑'

      // Find min/max
      const min = Math.min(...values)
      const max = Math.max(...values)
      const budget = budgets[pkg]

      console.log(`  ${pkg.padEnd(26)} ${arrow} ${trend}%  (min ${min.toFixed(1)} / max ${max.toFixed(1)} / budget ${budget}KB)`)
    }

    console.log(`\n  Total records: ${history.length} days`)
  }

  console.log()
  return overBudget > 0 ? 1 : 0
}
