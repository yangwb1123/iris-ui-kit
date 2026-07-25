#!/usr/bin/env node

/**
 * checks/progress.mjs — Project completion tracker.
 *
 * Summarizes the status of all engineering gates, showing which pass/fail/skip
 * in a dashboard-style output. Useful for sprint reviews and CI status at a glance.
 *
 * Run: node cli.mjs progress
 *      node cli.mjs progress --ci   (machine-readable JSON)
 */

import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'

const GATES = [
  { id: 'filesize',     name: 'File Size',           cmd: 'check-filesize' },
  { id: 'architecture', name: 'Architecture',        cmd: 'check-architecture' },
  { id: 'format',       name: 'Format (Prettier)',    cmd: 'check-format' },
  { id: 'rsc',          name: 'RSC Directive',        cmd: 'check-rsc' },
  { id: 'complexity',   name: 'Complexity',           cmd: 'check-complexity' },
  { id: 'exports',      name: 'Export Count',         cmd: 'check-exports' },
  { id: 'tokens',       name: 'Token Audit',          cmd: 'check-tokens' },
  { id: 'manifest',     name: 'Manifest',             cmd: 'check-manifest' },
  { id: 'parity',       name: 'Desktop Parity',       cmd: 'check-parity' },
  { id: 'framework',    name: 'Framework Parity',     cmd: 'check-framework' },
  { id: 'size',         name: 'Bundle Size',          cmd: 'check-size' },
  { id: 'change',       name: 'Change Budget',        cmd: 'change-budget' },
]

async function runGate(gate) {
  const start = Date.now()
  try {
    execSync(`node cli.mjs ${gate.cmd}`, { cwd: ROOT, stdio: 'pipe', timeout: 30000 })
    return { gate: gate.id, name: gate.name, cmd: gate.cmd, status: 'pass', ms: Date.now() - start }
  } catch (err) {
    const exitCode = err.status ?? 1
    return { gate: gate.id, name: gate.name, cmd: gate.cmd, status: exitCode === 124 ? 'timeout' : 'fail', ms: Date.now() - start }
  }
}

export async function run(opts = {}) {
  const isJson = opts.ci || process.argv.includes('--ci') || process.argv.includes('--json')

  console.log('═'.repeat(60))
  console.log('  Iris UI Progress Dashboard')
  console.log('═'.repeat(60))
  console.log()

  const results = await Promise.all(GATES.map(runGate))

  let pass = 0
  let fail = 0
  let timeout = 0

  for (const r of results) {
    if (r.status === 'pass') pass++
    else if (r.status === 'timeout') timeout++
    else fail++
    if (isJson) continue
    const icon = r.status === 'pass' ? '✓' : r.status === 'timeout' ? '⚠' : '✗'
    const msStr = `(${r.ms}ms)`
    console.log(`  ${icon} ${r.name.padEnd(24)} ${r.status.toUpperCase().padEnd(8)} ${msStr}`)
  }

  if (!isJson) {
    console.log(`\n  ${'─'.repeat(40)}`)
    console.log(`  ${pass} pass · ${fail} fail · ${timeout} timeout`)
    console.log(`  Total: ${results.length} gates\n`)

    if (fail > 0) {
      console.log('  Failed gates:')
      for (const r of results) {
        if (r.status === 'fail') console.log(`    node cli.mjs ${r.cmd}`)
      }
      console.log()
    }
  }

  if (isJson) {
    console.log(JSON.stringify({ project: 'iris-ui', gates: results, summary: { pass, fail, timeout, total: results.length } }, null, 2))
  }

  return fail > 0 ? 1 : 0
}