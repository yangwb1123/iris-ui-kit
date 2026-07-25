#!/usr/bin/env node

/**
 * checks/changelog.mjs — Generate changelog from git log.
 *
 * Produces a structured changelog from Conventional Commits since the last tag.
 * Useful for release notes and sprint reviews.
 *
 * Usage: node cli.mjs changelog [--since <tag>] [--format markdown|json]
 *   Default: since last tag, markdown format
 */

import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'

function sh(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }).trim() }
  catch { return '' }
}

export async function run(opts = {}) {
  const args = process.argv.slice(3)
  const since = args.includes('--since') ? args[args.indexOf('--since') + 1] : null
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'markdown'

  // Determine range
  let range
  if (since) {
    range = `${since}..HEAD`
  } else {
    const lastTag = sh('git describe --tags --abbrev=0 2>/dev/null')
    range = lastTag ? `${lastTag}..HEAD` : 'HEAD'
  }

  // Get commit log
  const log = sh(`git log ${range} --oneline --no-decorate 2>/dev/null`)
  if (!log) {
    console.log('No commits found in range.\n')
    return 0
  }

  const commits = log.split('\n').map(l => {
    const m = l.match(/^(\S+)\s+(.*)/)
    return m ? { hash: m[1], message: m[2] } : null
  }).filter(Boolean)

  // Categorize by conventional commit type
  const categories = {
    feat: [], fix: [], refactor: [], docs: [], test: [],
    chore: [], style: [], perf: [], revert: [], other: [],
  }

  for (const c of commits) {
    const type = c.message.match(/^(\w+)(?:\([^)]+\))?:/)
    const key = type ? type[1] : 'other'
    if (categories[key]) categories[key].push(c)
    else categories.other.push(c)
  }

  const cfg = getConfig()

  if (format === 'json') {
    console.log(JSON.stringify({
      project: cfg.project.name,
      range,
      total: commits.length,
      categories: Object.fromEntries(
        Object.entries(categories).filter(([, v]) => v.length > 0)
      ),
    }, null, 2))
    return 0
  }

  // Markdown output
  console.log(`# Changelog\n`)
  console.log(`> ${cfg.project.name} · ${range}\n`)

  const LABELS = {
    feat: '🚀 Features', fix: '🐛 Bug Fixes', refactor: '🔧 Refactoring',
    docs: '📚 Documentation', test: '🧪 Tests', chore: '🔩 Chores',
    style: '💄 Style', perf: '⚡ Performance', revert: '⏪ Reverts',
    other: '📦 Other',
  }

  for (const [key, label] of Object.entries(LABELS)) {
    if (categories[key].length === 0) continue
    console.log(`## ${label}\n`)
    for (const c of categories[key]) {
      const msg = c.message.replace(/^\w+(?:\([^)]+\))?:\s*/, '')
      const pkg = c.message.match(/\(([^)]+)\)/)
      const tag = pkg ? ` \`${pkg[1]}\`` : ''
      console.log(`- ${msg}${tag} (${c.hash})`)
    }
    console.log()
  }

  console.log(`---\n_${commits.length} commits_`)

  return 0
}