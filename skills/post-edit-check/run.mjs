#!/usr/bin/env node

/**
 * skills/post-edit-check/run.mjs — Post-edit validation skill.
 *
 * After making edits, runs the quick check gates (filesize, architecture)
 * and reports what changed. Catches regressions before commit.
 *
 * Usage: node cli.mjs skill post-edit-check [--diff]
 *
 * Analogous to snaplink docs/skills/post-edit-check/run.py
 */

import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')

export async function run(args = []) {
  console.log('=== Post-Edit Check ===\n')

  // 1. Run quick check gates
  const gates = ['check-filesize', 'check-architecture']
  let gateFailed = false

  for (const gate of gates) {
    const flag = args.includes('--diff') ? '--diff' : ''
    try {
      execSync(`node cli.mjs ${gate} ${flag}`, { cwd: ROOT, stdio: 'inherit', timeout: 30000 })
      console.log(`  ✓ ${gate}`)
    } catch {
      console.log(`  ✗ ${gate}`)
      gateFailed = true
    }
  }

  // 2. Show changed files
  try {
    const changed = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf-8', timeout: 5000 }).trim()
    if (changed) {
      const files = changed.split('\n')
      const goFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.vue') || f.endsWith('.svelte'))
      console.log(`\n  Source files changed (${goFiles.length}):`)
      if (goFiles.length > 0) {
        for (const f of goFiles.slice(0, 20)) console.log(`    ${f}`)
        if (goFiles.length > 20) console.log(`    ... and ${goFiles.length - 20} more`)
      }
    } else {
      console.log('\n  No changes detected.')
    }
  } catch { /* not a git repo */ }

  if (gateFailed) {
    console.log('\n❌ Post-edit check FAILED — fix before continuing\n')
    return 1
  }

  console.log('\n✅ Post-edit check passed\n')
  return 0
}