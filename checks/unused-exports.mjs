#!/usr/bin/env node

/**
 * checks/unused-exports.mjs — Detect unused exports with ts-prune.
 *
 * Wraps ts-prune to find exported symbols that are never imported elsewhere.
 * Helps prevent code bloat and dead code accumulation.
 *
 * Run: node cli.mjs check-unused [--dir packages/core/src]
 * Default: checks packages/core/src (the most critical package)
 */

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

export async function run(opts = {}) {
  const args = process.argv.slice(3).filter(a => !a.startsWith('--'))
  const targetDir = args[0] || 'packages/core/src'
  const targetPath = resolve(ROOT, targetDir)
  const cfg = getConfig()
  const maxUnused = cfg.complexity?.max_unused_exports ?? 10

  console.log(`--- Unused Exports Check: ${targetDir} ---\n`)

  try {
    const output = execSync(`npx ts-prune -p packages/core/tsconfig.json --include "${targetPath}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }).trim()

    const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('//') && !l.includes('(used in module)'))

    if (lines.length === 0) {
      console.log('  ✓ No unused exports found')
      return 0
    }

    // Filter to real unused exports (skip barrel re-exports and lines without location)
    const unused = lines.filter(l => {
      if (!l.includes(':')) return false
      // Skip barrel re-exports (lines from index.ts files)
      const filePart = l.split(':')[0]
      if (filePart.endsWith('/index.ts') || filePart === 'index.ts' || filePart.endsWith('/index')) return false
      return true
    })

    if (unused.length === 0) {
      console.log('  ✓ No unused exports found')
      return 0
    }

    console.log(`  Found ${unused.length} unused export(s) (max allowed: ${maxUnused})\n`)

    for (const line of unused.slice(0, 30)) {
      console.log(`    ${line.trim()}`)
    }

    if (unused.length > 30) {
      console.log(`    ... and ${unused.length - 30} more`)
    }

    if (unused.length > maxUnused) {
      console.log(`\n  ❌ ${unused.length} unused exports exceeds limit of ${maxUnused}`)
      return 1
    }

    console.log(`\n  ✓ Within limit (${unused.length}/${maxUnused})`)
    return 0

  } catch (err) {
    // ts-prune exits non-zero when it finds unused exports
    // stdout has the list, stderr may have progress info
    const output = err.stdout || err.stderr || ''
    const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('//'))
    const unused = lines.filter(l => {
      if (!l.includes(':')) return false
      const filePart = l.split(':')[0]
      if (filePart.endsWith('/index.ts') || filePart === 'index.ts' || filePart.endsWith('/index')) return false
      return true
    })

    if (unused.length > 0) {
      console.log(`  Found ${unused.length} unused export(s) (max allowed: ${maxUnused})\n`)

      for (const line of unused.slice(0, 30)) {
        console.log(`    ${line.trim()}`)
      }

      if (unused.length > 30) {
        console.log(`    ... and ${unused.length - 30} more`)
      }

      if (unused.length > maxUnused) {
        console.log(`\n  ❌ ${unused.length} unused exports exceeds limit of ${maxUnused}`)
        return 1
      }

      console.log(`\n  ✓ Within limit (${unused.length}/${maxUnused})`)
      return 0
    }

    console.log(`  ⚠️  ts-prune error: ${err.message}`)
    return 1
  }
}