#!/usr/bin/env node

/**
 * checks/change-budget.mjs — Change budget gate.
 *
 * Every coding iteration should be ≤5 files, ≤300 lines of core logic.
 * >10 files is a hard stop. Thresholds from iris.yaml (change_budget:).
 *
 * Migration from scripts/change-budget.mjs.
 */

import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'

export async function run(opts = {}) {
  const cfg = getConfig()
  const { target_files, target_core_lines, hard_stop_files } = cfg.change_budget
  const isStaged = opts.staged || process.argv.includes('--staged')
  const isEnforce = opts.enforce || process.argv.includes('--enforce')

  const GENERATED = [
    /(^|\/)dist\//,
    /\.d\.ts$/,
    /(^|\/)manifest\.json$/,
    /(^|\/)llms\.txt$/,
    /pnpm-lock\.yaml$/,
    /(^|\/)\.svelte-kit\//,
    /(^|\/)\.next\//,
    /(^|\/)arch-baseline\.json$/,
  ]
  const isGenerated = p => GENERATED.some(r => r.test(p))
  const isTest = p => /\.(test|spec)\.[tj]sx?$/.test(p) || /\.test\.ts$/.test(p)
  const isDoc = p => /\.(md|mdx)$/.test(p)

  const cmd = isStaged ? 'git diff --cached --numstat' : 'git diff --numstat HEAD'
  let numstat
  try {
    numstat = execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim()
  } catch {
    console.log('Note: not a git repository or no changes yet.')
    return 0
  }

  const rows = numstat.split('\n').filter(Boolean)
  const files = []
  let coreAdded = 0

  for (const row of rows) {
    const [add, , ...rest] = row.split('\t')
    const filePath = rest.join('\t')
    if (!filePath || isGenerated(filePath)) continue
    files.push(filePath)
    if (!isTest(filePath) && !isDoc(filePath) && add !== '-') {
      coreAdded += Number(add) || 0
    }
  }

  let exitCode = 0
  console.log(`\n📦 Change budget (${isStaged ? 'staged' : 'vs HEAD'})`)
  console.log(`   Files: ${files.length}  (target ≤${target_files}, hard stop >${hard_stop_files})`)
  console.log(`   Core logic lines added: ${coreAdded}  (target ≤${target_core_lines})\n`)

  const warns = []
  if (files.length > target_files) {
    warns.push(`Changed ${files.length} files, over target ${target_files} (multi-framework fan-out is a known exception)`)
  }
  if (coreAdded > target_core_lines) {
    warns.push(`Added ${coreAdded} core logic lines, over target ${target_core_lines}`)
  }
  if (files.length > hard_stop_files) {
    const msg = `Changed ${files.length} files, over hard stop ${hard_stop_files} — split into iterations`
    if (isEnforce) {
      console.log(`❌ Hard stop: ${msg}\n`)
      return 1
    }
    warns.push(msg)
  }

  if (warns.length > 0) {
    console.log('⚠️  Budget warnings (not blocking):')
    for (const w of warns) console.log(`   ${w}`)
    console.log()
  } else {
    console.log('✅ Within budget\n')
  }

  return 0
}