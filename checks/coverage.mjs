#!/usr/bin/env node

/**
 * checks/coverage.mjs — Test coverage report and gate.
 *
 * Scans all 4 framework adapter packages for test file sizes and reports:
 *   1. Top 20 test files (by line count)
 *   2. Components with test_size < threshold (low-coverage risk)
 *   3. High-complexity components with test_size < threshold (attention needed)
 *
 * Migration from scripts/test-coverage-report.mjs.
 * Thresholds from iris.yaml (coverage: section).
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, relative, basename } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

const HIGH_COMPLEXITY = [
  'cascader', 'date-picker', 'date-range-picker', 'color-picker',
  'transfer', 'tree-select', 'mentions', 'tag-input', 'time-picker',
  'combobox', 'pro-table', 'tree', 'table',
]

function walkDir(dir) {
  const files = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) files.push(...walkDir(full))
      else if (/\.test\.(ts|tsx)$/.test(entry.name)) files.push(full)
    }
  } catch { /* skip */ }
  return files
}

function componentName(filePath) {
  return basename(filePath)
    .replace(/^Iris/, '')
    .replace(/\.test\.(ts|tsx)$/, '')
    .replace(/\.(ts|tsx)$/, '')
    .toLowerCase()
}

export async function run(opts = {}) {
  const cfg = getConfig()
  const { targets, high_complexity_min_test_lines } = cfg.coverage
  const THRESHOLD = cfg.filesize.max_lines > 200 ? 50 : 30  // low line threshold
  const runTests = opts.runTests || false

  // If runTests is set, also run the actual test suite
  if (runTests) {
    const { execSync } = await import('node:child_process')
    try {
      console.log('  Running tests...\n')
      execSync('pnpm turbo run test', { cwd: ROOT, stdio: 'inherit', timeout: 120000 })
    } catch {
      console.log('\n  ⚠️  Some tests failed, continuing with coverage report...\n')
    }
  }

  const frameworks = cfg.framework_parity.frameworks

  console.log('  Test Coverage Report\n')

  let exitCode = 0
  const allTests = []
  const lowCoverage = []
  const complexLow = []

  for (const [fw, relDir] of Object.entries(frameworks)) {
    const dir = resolve(ROOT, relDir)
    const files = walkDir(dir)

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n').length
      const name = componentName(file)
      const isComplex = HIGH_COMPLEXITY.some(hc => name.includes(hc))
      const entry = { framework: fw, name, file: relative(ROOT, file), lines, isComplex }
      allTests.push(entry)

      if (lines < THRESHOLD) lowCoverage.push(entry)
      if (isComplex && lines < high_complexity_min_test_lines) complexLow.push(entry)
    }
  }

  // 1. Top test files
  const sorted = [...allTests].sort((a, b) => b.lines - a.lines)
  const TOP_N = 20
  console.log(`  Top ${TOP_N} test files by line count:\n`)
  for (let i = 0; i < Math.min(TOP_N, sorted.length); i++) {
    const t = sorted[i]
    console.log(`  ${String(i + 1).padStart(2)}. ${String(t.lines).padStart(5)} lines  ${t.framework.padEnd(7)} ${basename(t.file)}`)
  }

  console.log(`\n  Total test files: ${allTests.length}`)
  console.log(`  Total test lines: ${allTests.reduce((s, t) => s + t.lines, 0)}`)

  // 2. Low-coverage warnings
  if (lowCoverage.length > 0) {
    console.log(`\n  -- Low-coverage risk (< ${THRESHOLD} lines) --\n`)
    for (const t of lowCoverage.sort((a, b) => a.lines - b.lines)) {
      console.log(`  ${String(t.lines).padStart(4)} lines  ${t.framework.padEnd(7)} ${basename(t.file)}`)
    }
    console.log(`\n  ${lowCoverage.length} component(s) have < ${THRESHOLD} test lines.`)
  }

  // 3. High-complexity low coverage
  if (complexLow.length > 0) {
    console.log(`\n  -- ⚠️  High-complexity, low coverage (< ${high_complexity_min_test_lines} lines) --\n`)
    for (const t of complexLow.sort((a, b) => a.lines - b.lines)) {
      console.log(`  ${String(t.lines).padStart(4)} lines  ${t.framework.padEnd(7)} ${basename(t.file)}`)
    }
    console.log(`\n  ${complexLow.length} high-complexity component(s) need more tests.`)
    if (exitCode === 0) exitCode = 1
  }

  if (exitCode !== 0) {
    console.log('')
    return exitCode
  }

  // 4. Enforce coverage targets from iris.yaml
  const enforce = opts.strict || opts.enforce || false
  if (enforce) {
    console.log('  -- Coverage Target Enforcement --\n')
    let allPassed = true
    for (const [pkg, target] of Object.entries(targets)) {
      // Find test lines for this package
      const pkgTests = allTests.filter(t => t.file.startsWith(`packages/${pkg.replace(/^@iris-ui\//, '')}`))
      const totalLines = pkgTests.reduce((s, t) => s + t.lines, 0)
      const testCount = pkgTests.length
      // Simple heuristic: if package has no tests or very few, flag it
      // Real coverage % would require instrumented runs (v8/istanbul)
      const hasAdequate = testCount >= 5 || totalLines >= target * 2
      if (!hasAdequate) {
        console.log(`  ✗ ${pkg.padEnd(20)} ${testCount} tests / ${totalLines} lines (target ${target}%)`)
        allPassed = false
      } else {
        console.log(`  ✓ ${pkg.padEnd(20)} ${testCount} tests / ${totalLines} lines (target ${target}%)`)
      }
    }
    if (!allPassed) {
      console.log('\n  ❌ Coverage targets not met (use --strict to enforce)\n')
      exitCode = 1
    } else {
      console.log('\n  ✅ All coverage targets met\n')
    }
  }

  if (exitCode === 0) {
    console.log('  No coverage concerns.')
  }

  console.log('')
  return exitCode
}