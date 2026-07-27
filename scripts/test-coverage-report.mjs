#!/usr/bin/env node

/**
 * pnpm test:coverage-report
 *
 * Scans all 4 framework adapter packages for test file sizes and reports:
 *   1. Top 20 test files (by line count)
 *   2. Components with test_size < 50 lines (low-coverage risk)
 *   3. High-complexity components with test_size < 100 lines (attention needed)
 *
 * Exit code:
 *   0 — clean (no high-complexity components below threshold)
 *   1 — warnings (low-coverage or attention-needed components)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const LOW_THRESHOLD = 50 // lines: flag as low-coverage risk
const HIGH_COMPLEXITY_THRESHOLD = 100 // lines: flag for attention-needed
const TOP_N = 20

const FRAMEWORKS = {
  react: 'packages/react/src/primitives',
  vue: 'packages/vue/src/primitives',
  solid: 'packages/solid/src/primitives',
  svelte: 'packages/svelte/src/primitives',
}

/** Components considered "high-complexity" — they need more test coverage. */
const HIGH_COMPLEXITY = [
  'cascader',
  'date-picker',
  'date-range-picker',
  'color-picker',
  'transfer',
  'tree-select',
  'mentions',
  'tag-input',
  'time-picker',
  'combobox',
  'pro-table',
  'tree',
  'table',
]

function walkDir(dir) {
  const files = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...walkDir(full))
      } else if (/\.test\.(ts|tsx)$/.test(entry.name)) {
        files.push(full)
      }
    }
  } catch {
    /* not found */
  }
  return files
}

function componentName(filePath) {
  const name = path.basename(filePath)
  // Strip framework-specific prefixes (Iris*, Iris*) and test suffixes
  return name
    .replace(/^Iris/, '')
    .replace(/\.test\.(ts|tsx)$/, '')
    .replace(/\.(ts|tsx)$/, '')
    .toLowerCase()
}

function isHighComplexity(name) {
  return HIGH_COMPLEXITY.some((hc) => name.includes(hc))
}

function main() {
  console.log('  Test Coverage Report')
  console.log('')

  let exitCode = 0
  const allTests = [] // individual files, used by the size ranking

  for (const [fw, relDir] of Object.entries(FRAMEWORKS)) {
    const dir = path.join(ROOT, relDir)
    const files = walkDir(dir)

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n').length
      const name = componentName(file)
      const relativeFile = path.relative(dir, file)
      const segments = relativeFile.split(path.sep)
      const component = segments.length > 1 ? segments[0] : name
      const entry = {
        framework: fw,
        name,
        component,
        file: path.relative(ROOT, file),
        lines,
      }
      allTests.push(entry)
    }
  }

  // Coverage risk is a component-level signal. A complex primitive such as
  // Table deliberately splits scenarios across Table.test, Table.defaults,
  // Table.row-click, export, and contract files; judging each supplemental file
  // independently produces false failures despite substantial aggregate tests.
  const componentTotals = new Map()
  for (const test of allTests) {
    const key = `${test.framework}:${test.component}`
    const current = componentTotals.get(key)
    if (current) current.lines += test.lines
    else {
      componentTotals.set(key, {
        framework: test.framework,
        name: test.component,
        lines: test.lines,
        isComplex: isHighComplexity(test.component),
      })
    }
  }
  const components = [...componentTotals.values()]
  const lowCoverage = components.filter((component) => component.lines < LOW_THRESHOLD)
  const complexLow = components.filter(
    (component) => component.isComplex && component.lines < HIGH_COMPLEXITY_THRESHOLD,
  )

  // 1. Top N test files
  const sorted = [...allTests].sort((a, b) => b.lines - a.lines)
  console.log(`  Top ${TOP_N} test files by line count:\n`)
  for (let i = 0; i < Math.min(TOP_N, sorted.length); i++) {
    const t = sorted[i]
    console.log(
      `  ${String(i + 1).padStart(2)}. ${t.lines.toString().padStart(5)} lines  ${t.framework.padEnd(7)} ${path.basename(t.file)}`,
    )
  }

  console.log('')
  console.log(`  Total test files: ${allTests.length}`)
  console.log(`  Total test lines: ${allTests.reduce((s, t) => s + t.lines, 0)}`)

  // 2. Low-coverage flags
  console.log('')
  console.log(`  -- Low-coverage risk (< ${LOW_THRESHOLD} lines) -------------------------`)
  console.log('')
  if (lowCoverage.length === 0) {
    console.log('  None found.')
  } else {
    for (const t of lowCoverage.sort((a, b) => a.lines - b.lines)) {
      console.log(`  ${t.lines.toString().padStart(4)} lines  ${t.framework.padEnd(7)} ${t.name}`)
    }
    console.log(`\n  ${lowCoverage.length} component(s) have < ${LOW_THRESHOLD} test lines.`)
  }

  // 3. High-complexity components needing more coverage
  console.log('')
  console.log(
    `  -- High-complexity components needing attention (< ${HIGH_COMPLEXITY_THRESHOLD} lines) ----`,
  )
  console.log('')
  if (complexLow.length === 0) {
    console.log('  None found — all high-complexity components have adequate coverage.')
  } else {
    for (const t of complexLow.sort((a, b) => a.lines - b.lines)) {
      console.log(`  ${t.lines.toString().padStart(4)} lines  ${t.framework.padEnd(7)} ${t.name}`)
    }
    console.log(
      `\n  ${complexLow.length} high-complexity component(s) have < ${HIGH_COMPLEXITY_THRESHOLD} test lines.`,
    )
    exitCode = 1
  }

  // 4. Per-framework summary
  console.log('')
  console.log('  -- Per-framework summary -------------------------------------------')
  console.log('')
  for (const fw of Object.keys(FRAMEWORKS)) {
    const fwTests = allTests.filter((t) => t.framework === fw)
    const totalLines = fwTests.reduce((s, t) => s + t.lines, 0)
    const avg = fwTests.length > 0 ? Math.round(totalLines / fwTests.length) : 0
    const low = lowCoverage.filter((t) => t.framework === fw).length
    const complex = complexLow.filter((t) => t.framework === fw).length
    console.log(
      `  ${fw.padEnd(7)} ${String(fwTests.length).padStart(4)} test files  ${String(totalLines).padStart(7)} lines  avg ${String(avg).padStart(4)}  low:${low}  complex:${complex}`,
    )
  }

  console.log('')
  console.log(exitCode === 0 ? '  No issues found.' : '  Some components need more test coverage.')
  console.log('')
  process.exit(exitCode)
}

main()
