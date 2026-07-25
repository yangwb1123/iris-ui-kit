#!/usr/bin/env node
/**
 * Bundle analysis script.
 *
 * Measures the gzipped size of each package's dist/index.js and reports
 * against the budgets in iris.yaml. Also generates a per-package breakdown
 * of sub-path exports.
 *
 * Usage:
 *   node scripts/analyze-bundle.mjs
 *   node scripts/analyze-bundle.mjs --json   # JSON output for CI
 */

import { readFileSync, existsSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IS_JSON = process.argv.includes('--json')

// Load budgets from iris.yaml (simple YAML parser — no dependency)
const yamlText = readFileSync(resolve(ROOT, 'iris.yaml'), 'utf8')
const budgets = {}
for (const line of yamlText.split('\n')) {
  const m = line.match(/"@iris-ui\/[\w-]+":\s*(\d+)/)
  if (m) {
    const pkg = line.match(/@iris-ui\/[\w-]+/)[0]
    budgets[pkg] = parseInt(m[1], 10)
  }
}

/** Compute gzipped size of a file. */
function gzipSize(filePath) {
  if (!existsSync(filePath)) return null
  const content = readFileSync(filePath)
  return gzipSync(content).length
}

/** Format bytes as human-readable. */
function fmt(bytes) {
  if (bytes == null) return 'N/A'
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

const results = []
const packages = readdirSync(resolve(ROOT, 'packages'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(resolve(ROOT, 'packages', d.name, 'package.json')))

for (const pkg of packages) {
  const pkgDir = resolve(ROOT, 'packages', pkg.name)
  const distDir = resolve(pkgDir, 'dist')
  if (!existsSync(distDir)) continue

  const mainPath = resolve(distDir, 'index.js')
  const mainSize = gzipSize(mainPath)
  const budget = budgets[`@iris-ui/${pkg.name}`]
  const pct = mainSize != null && budget ? ((mainSize / 1024 / budget) * 100).toFixed(1) : null

  // Measure sub-path exports
  const subExports = []
  const entries = readdirSync(distDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'index.js') {
      const subSize = gzipSync(readFileSync(resolve(distDir, entry.name))).length
      subExports.push({ name: entry.name.replace('.js', ''), size: subSize })
    }
  }

  results.push({
    name: `@iris-ui/${pkg.name}`,
    mainSize,
    budget: budget ? `${budget} KB` : null,
    pct: pct ? `${pct}%` : null,
    status: mainSize != null && budget ? (mainSize / 1024 <= budget ? '✅' : '❌') : '➖',
    subExports: subExports.sort((a, b) => b.size - a.size),
  })
}

if (IS_JSON) {
  process.stdout.write(JSON.stringify(results, null, 2) + '\n')
} else {
  console.log('\n=== Iris UI Bundle Analysis ===\n')
  console.log('Package'.padEnd(28), 'Main (gz)'.padEnd(14), 'Budget'.padEnd(10), 'Status')
  console.log('─'.repeat(65))
  for (const r of results) {
    console.log(
      r.name.padEnd(28),
      fmt(r.mainSize).padEnd(14),
      (r.budget ?? '—').padEnd(10),
      r.status,
    )
    if (r.subExports.length > 0 && !IS_JSON) {
      for (const sub of r.subExports.slice(0, 5)) {
        console.log(`  ├─ ${sub.name.padEnd(24)} ${fmt(sub.size)}`)
      }
      if (r.subExports.length > 5) {
        console.log(`  └─ … and ${r.subExports.length - 5} more sub-exports`)
      }
    }
  }

  const passed = results.filter((r) => r.status === '✅').length
  const failed = results.filter((r) => r.status === '❌').length
  const total = results.filter((r) => r.status !== '➖').length
  console.log(`\n${passed}/${total} packages within budget${failed > 0 ? `, ${failed} over budget!` : ''}`)
  console.log('')
}
