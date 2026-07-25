#!/usr/bin/env node

/**
 * checks/diagnose.mjs — Environment diagnostics.
 *
 * Reports on the development environment: Node version, git status,
 * disk usage, build artifacts, etc. Useful for debugging CI failures.
 *
 * Analogous to snaplink's `cli.py diagnose`.
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

function sh(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 5000 }).trim() }
  catch { return '(error)' }
}

export async function run() {
  const cfg = getConfig()

  console.log('=== Iris UI Diagnostics ===\n')

  // 1. Node & environment
  console.log('── Environment ──')
  console.log(`  Node:       ${process.version}`)
  console.log(`  Platform:   ${process.platform} ${process.arch}`)
  console.log(`  CWD:        ${ROOT}`)

  // 2. Git status
  console.log('\n── Git ──')
  try {
    const branch = sh('git rev-parse --abbrev-ref HEAD')
    const commit = sh('git rev-parse --short HEAD')
    const status = sh('git status --short | wc -l')
    console.log(`  Branch:     ${branch}`)
    console.log(`  Commit:     ${commit}`)
    console.log(`  Uncommitted: ${status} file(s)`)
  } catch {
    console.log('  (not a git repository)')
  }

  // 3. Package dist status
  console.log('\n── Build Artifacts ──')
  for (const [pkgName, budgetKb] of Object.entries(cfg.size.budgets)) {
    const pkgDir = pkgName.replace(/^@iris-ui\//, '')
    const distPath = resolve(ROOT, 'packages', pkgDir, 'dist', 'index.js')
    if (existsSync(distPath)) {
      const size = sh(`wc -c "${distPath}"`).split(/\s/)[0] || '?'
      console.log(`  ✓ ${pkgName.padEnd(20)} ${(size / 1024).toFixed(1)}KB`)
    } else {
      console.log(`  ✗ ${pkgName.padEnd(20)} dist/index.js missing`)
    }
  }

  // 4. Test status
  console.log('\n── Test Status ──')
  const hasTestResults = existsSync(resolve(ROOT, 'coverage'))
  console.log(`  Coverage dir: ${hasTestResults ? 'present' : 'absent'}`)

  // 5. Config summary
  console.log('\n── Config ──')
  console.log(`  Project:     ${cfg.project.name} (${cfg.project.language})`)
  console.log(`  Filesize:    max ${cfg.filesize.max_lines} lines`)
  console.log(`  Exemptions:  ${cfg.filesize.exemptions.length} files`)
  const activeGates = [
    'filesize', 'architecture', 'complexity', 'size', 'rsc',
    'tokens', 'framework-parity', 'desktop-parity', 'change-budget',
  ]
  console.log(`  Active gates: ${activeGates.length}`)

  console.log()
  return 0
}