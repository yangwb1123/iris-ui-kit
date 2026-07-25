#!/usr/bin/env node

/**
 * checks/filesize.mjs — File size gate.
 *
 * Ensures source files stay under the configured line budget. Reads thresholds,
 * ignore patterns, and exemptions from iris.yaml (filesize: section).
 *
 * Mode:
 *   normal   — full scan, fail on oversize (respect baselines if applicable)
 *   --strict — full scan, fail on ALL oversize (ignores baselines)
 *   --diff   — only git-changed files
 *
 * Migration from scripts/arch-check.mjs:
 *   Makes line-count checking config-driven vs hardcoded.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'

// Extensions considered source code
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.vue', '.svelte'])

function isSourceFile(filePath) {
  const ext = filePath.split('.').pop()
  return SOURCE_EXTS.has('.' + ext) && !filePath.endsWith('.d.ts')
}

function isTestFile(filePath) {
  return /\.(test|spec)\.(ts|tsx)$/.test(filePath)
}

function collectFiles(dir, ignorePatterns) {
  const results = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !ignorePatterns.some(p => full.includes(p))) {
          results.push(...collectFiles(full, ignorePatterns))
        }
      } else if (entry.isFile() && isSourceFile(full)) {
        results.push(full)
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results
}

function getChangedFiles() {
  try {
    const diffOutput = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim()
    const stagedOutput = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf-8' }).trim()
    return [...new Set([...diffOutput.split('\n'), ...stagedOutput.split('\n')])]
      .filter(Boolean)
      .map(f => resolve(ROOT, f))
      .filter(f => isSourceFile(f))
      .filter(f => f.includes('/packages/'))
  } catch { return [] }
}

export async function run(opts = {}) {
  const cfg = getConfig()
  const { max_lines, ignore_patterns, exemptions } = cfg.filesize
  const isDiff = opts.diff || process.argv.includes('--diff')
  const isStrict = opts.strict || process.argv.includes('--strict')

  const ignoreDirs = ignore_patterns.map(p => p.replace(/\/$/, ''))

  let files
  if (isDiff) {
    files = getChangedFiles()
    if (files.length === 0) {
      console.log('PASS: filesize (no changed files)')
      return 0
    }
  } else {
    files = collectFiles(resolve(ROOT, 'packages'), ignoreDirs)
  }

  let failed = 0
  let warnings = 0
  const total = files.length

  for (const file of files) {
    const rel = relative(ROOT, file)

    // Check ignore patterns
    if (ignoreDirs.some(p => rel.startsWith(p) || rel.includes('/' + p))) continue

    // Check exemptions
    if (exemptions.some(e => rel === e || rel.endsWith('/' + e))) continue

    let content
    try {
      content = readFileSync(file, 'utf-8')
    } catch { continue }

    const lines = content.split('\n').length
    const max = isTestFile(file) ? max_lines : max_lines
    const label = isTestFile(file) ? 'TEST' : 'SOURCE'

    if (lines > max) {
      console.log(`  FAIL: ${rel} (${lines} lines, max ${max})`)
      failed++
    } else if (lines > max * 0.9) {
      console.log(`  WARN: ${rel} (${lines} lines, ${Math.round(lines / max * 100)}% of max ${max})`)
      warnings++
    }
  }

  console.log(`\nFilesize check: ${total} files, ${failed} failed, ${warnings} warnings`)

  if (failed > 0) {
    console.log('FAIL: split large files before continuing')
    return 1
  }

  console.log('PASS: filesize')
  return 0
}