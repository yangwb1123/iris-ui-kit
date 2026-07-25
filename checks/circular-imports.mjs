#!/usr/bin/env node

/**
 * checks/circular-imports.mjs — Detect circular dependencies with madge.
 *
 * Wraps madge to find circular import chains between modules.
 * Circular dependencies break tree-shaking and cause runtime issues.
 *
 * Run: node cli.mjs check-circular [--dir packages/core/src]
 * Default: checks packages/core/src
 */

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

export async function run(opts = {}) {
  const args = process.argv.slice(3).filter(a => !a.startsWith('--'))
  const targetDir = args[0] || 'packages/core/src/index.ts'
  const targetPath = resolve(ROOT, targetDir)
  const cfg = getConfig()
  const maxCircular = cfg.complexity?.max_circular_deps ?? 5

  console.log(`--- Circular Import Check: ${targetDir} ---\n`)

  try {
    const output = execSync(`npx madge --circular --extensions ts,tsx "${targetPath}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    }).trim()

    // madge returns empty output when no circular deps
    if (!output || output.includes('No circular dependencies found')) {
      console.log('  ✓ No circular dependencies found')
      return 0
    }

    // Parse madge output — it lists circular chains
    const lines = output.split('\n').filter(l => l.trim())
    const circularCount = lines.length

    console.log(`  Found ${circularCount} circular chain(s) (max allowed: ${maxCircular})\n`)

    for (const line of lines.slice(0, 20)) {
      console.log(`    ${line.trim()}`)
    }

    if (lines.length > 20) {
      console.log(`    ... and ${lines.length - 20} more`)
    }

    if (circularCount > maxCircular) {
      console.log(`\n  ❌ ${circularCount} circular deps exceeds limit of ${maxCircular}`)
      return 1
    }

    console.log(`\n  ✓ Within limit (${circularCount}/${maxCircular})`)
    return 0

  } catch (err) {
    // madge exits non-zero when it finds circular deps
    const output = err.stdout || ''
    if (output.includes('No circular dependencies')) {
      console.log('  ✓ No circular dependencies found')
      return 0
    }

    const lines = output.split('\n').filter(l => l.trim())
    if (lines.length > 0 && !lines[0].includes('Usage') && !lines[0].includes('Error')) {
      const circularCount = lines.length
      console.log(`  Found ${circularCount} circular chain(s) (max allowed: ${maxCircular})\n`)

      for (const line of lines.slice(0, 20)) {
        console.log(`    ${line.trim()}`)
      }

      if (lines.length > 20) {
        console.log(`    ... and ${lines.length - 20} more`)
      }

      if (circularCount > maxCircular) {
        console.log(`\n  ❌ ${circularCount} circular deps exceeds limit of ${maxCircular}`)
        return 1
      }

      console.log(`\n  ✓ Within limit (${circularCount}/${maxCircular})`)
      return 0
    }

    console.log(`  ⚠️  madge error: ${err.message}`)
    return 1
  }
}