#!/usr/bin/env node

/**
 * skills/code-review-prep/run.mjs — Prepare a code review from the current diff.
 *
 * Analyzes the current git diff and generates a structured code review checklist
 * including which checks to run, which files to focus on, and known risk areas.
 *
 * Usage: node cli.mjs skill code-review-prep [--staged]
 */

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const ROOT = __dirname

function sh(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }).trim() }
  catch { return '' }
}

export async function run(args = []) {
  const diffTarget = args.includes('--staged') ? '--cached' : 'HEAD'
  const isStaged = args.includes('--staged')

  console.log('=== Code Review Preparation ===\n')

  // 1. Get changed files
  const changed = sh(`git diff ${isStaged ? '--cached' : '--name-only'} 2>/dev/null`).split('\n').filter(Boolean)

  if (changed.length === 0) {
    console.log('  No changes detected.')
    return 0
  }

  console.log(`  Changes: ${changed.length} file(s)\n`)

  // 2. Categorize files
  const categories = {
    core: changed.filter(f => f.startsWith('packages/core/')),
    react: changed.filter(f => f.startsWith('packages/react/')),
    vue: changed.filter(f => f.startsWith('packages/vue/')),
    solid: changed.filter(f => f.startsWith('packages/solid/')),
    svelte: changed.filter(f => f.startsWith('packages/svelte/')),
    config: changed.filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')),
    test: changed.filter(f => f.includes('.test.')),
    other: [],
  }

  for (const f of changed) {
    const categorized = Object.values(categories).some(c => c.includes(f))
    if (!categorized) categories.other.push(f)
  }

  for (const [key, files] of Object.entries(categories)) {
    if (files.length === 0) continue
    console.log(`  ${key.padEnd(8)} ${files.length} file(s)`)
    for (const f of files.slice(0, 5)) {
      console.log(`           ${f}`)
    }
    if (files.length > 5) console.log(`           ... and ${files.length - 5} more`)
    console.log()
  }

  // 3. Determine which checks to run
  const recommendedChecks = ['check-filesize --diff', 'check-architecture', 'check-format']

  if (categories.core.length > 0) {
    recommendedChecks.push('check-complexity', 'check-exports', 'check-circular')
  }
  if (categories.react.length > 0 || categories.vue.length > 0 ||
      categories.solid.length > 0 || categories.svelte.length > 0) {
    recommendedChecks.push('check-framework')
  }
  if (categories.test.length > 0) {
    recommendedChecks.push('check-coverage')
  }

  console.log('  Recommended checks:\n')
  for (const check of recommendedChecks) {
    console.log(`    node cli.mjs ${check}`)
  }

  // 4. Risk assessment
  console.log('\n  Risk assessment:\n')

  if (categories.core.length > 5) {
    console.log('    ⚠️  Large core change — run full acceptance suite')
  }
  if (categories.react.length > 0 && categories.vue.length === 0) {
    console.log('    ⚠️  React-only change — verify if Vue/Solid/Svelte need updates')
  }
  if (changed.some(f => f.endsWith('.ts') || f.endsWith('.tsx')) && !changed.some(f => f.includes('.test.'))) {
    console.log('    ℹ️  No test files in diff — add tests for new logic')
  }

  if (changed.length > 15) {
    console.log('    ⚠️  Large diff — consider splitting into smaller PRs')
  }

  // 5. Show diff stats
  const additions = sh(`git diff ${isStaged ? '--cached' : ''} --shortstat 2>/dev/null`)
  if (additions) {
    console.log(`\n  Diff stats: ${additions}`)
  }

  console.log('\n✅ Code review prep complete.\n')
  return 0
}