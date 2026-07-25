#!/usr/bin/env node

/**
 * checks/size.mjs — Bundle size budget gate (gzip).
 *
 * Measures gzipped size of dist/index.js for each package and fails if a
 * budget is exceeded. Budgets defined in iris.yaml (size: section).
 * Supports --update-baseline for baseline baselining.
 *
 * Migration from scripts/check-size.mjs.
 * Zero dependencies: node:zlib only.
 */

import { gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

const KB = 1024

export async function run(opts = {}) {
  const cfg = getConfig()
  const budgets = cfg.size.budgets
  const baselinePath = resolve(ROOT, cfg.size.budget_baseline_path)
  const updateBaseline = opts.updateBaseline || process.argv.includes('--update-baseline')

  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
  const current = {}
  let failed = false
  const rows = []

  console.log('\nBundle size budget — whole package (gzip)\n' + '─'.repeat(48))

  for (const [pkgName, budgetKb] of Object.entries(budgets)) {
    const pkgDir = pkgName.replace(/^@iris-ui\//, '')
    const entry = resolve(ROOT, 'packages', pkgDir, 'dist', 'index.js')

    if (!existsSync(entry)) {
      rows.push({ pkg: pkgName, status: 'MISSING', detail: 'dist/index.js not found — run build first' })
      failed = true
      continue
    }

    const gzipKb = gzipSync(readFileSync(entry)).length / KB
    const size = Number(gzipKb.toFixed(2))
    current[pkgName] = size
    const over = size > budgetKb
    if (over) failed = true

    const prev = baseline[pkgName]
    const delta = prev !== undefined ? ` (Δ ${(size - prev) > 0 ? '+' : ''}${(size - prev).toFixed(1)}KB)` : ''

    rows.push({
      pkg: pkgName,
      status: over ? 'OVER' : 'ok',
      detail: `${size.toFixed(1)}KB / ${budgetKb}KB gzip${delta}`,
    })
  }

  // Print table
  const MARK = { ok: '✓', OVER: '✗', MISSING: '✗' }
  for (const r of rows) {
    const mark = MARK[r.status] ?? '?'
    const label = r.pkg.startsWith('@') ? r.pkg : `@iris-ui/${r.pkg}`
    console.log(`${mark} ${label.padEnd(22)} ${r.status.padEnd(8)} ${r.detail}`)
  }

  if (updateBaseline) {
    writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n')
    console.log(`\n✓ Wrote baseline → ${cfg.size.budget_baseline_path} (${Object.keys(current).length} entries)`)
    return 0
  }

  console.log('─'.repeat(48))

  if (failed) {
    console.error('\n✗ Size budget exceeded — trim the change or raise the budget deliberately.\n')
    return 1
  }

  console.log('\n✓ All packages within budget\n')
  return 0
}