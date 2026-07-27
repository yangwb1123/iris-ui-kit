#!/usr/bin/env node

/**
 * checks/report.mjs — Run checks with JSON output for CI/machine consumption.
 *
 * Runs one or more checks and outputs structured JSON with pass/fail status,
 * timing, and error details. Useful for GitHub Actions and dashboards.
 *
 * Usage: node cli.mjs report [check1 check2 ...]
 *   Default: all gates defined in progress dashboard
 */

import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ALL_CHECKS = [
  'check-filesize', 'check-architecture', 'check-format', 'check-rsc',
  'check-complexity', 'check-exports', 'check-tokens', 'check-manifest',
  'check-parity', 'check-framework', 'check-size', 'change-budget',
  'check-coverage',
]

export async function run(opts = {}) {
  const args = process.argv.slice(3).filter(a => !a.startsWith('--'))
  const checks = args.length > 0 ? args : ALL_CHECKS
  const results = []

  for (const check of checks) {
    const start = Date.now()
    let status = 'error'
    let output = ''

    try {
      output = execSync(`node cli.mjs ${check}`, {
        cwd: ROOT, stdio: 'pipe', timeout: 30000, encoding: 'utf-8',
      }).trim()
      status = 'pass'
    } catch (err) {
      status = 'fail'
      output = (err.stdout || '').trim() || err.message
    }

    results.push({
      check,
      status,
      duration_ms: Date.now() - start,
      output: output.split('\n').slice(0, 5).join('; '), // brief summary
    })
  }

  const summary = {
    project: getConfig().project.name,
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    results,
  }

  console.log(JSON.stringify(summary, null, 2))
  return summary.failed > 0 ? 1 : 0
}