#!/usr/bin/env node

/**
 * checks/dashboard.mjs — Generate an HTML dashboard from check results.
 *
 * Runs all gates and generates a standalone HTML page with pass/fail status,
 * timing, and trend indicators. Can serve as CI artifact or local report.
 *
 * Usage: node cli.mjs dashboard [--output <path>] [--open]
 *   --output: Output path (default: dashboard.html)
 *   --open:   Open in browser after generation
 */

import { execSync } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

const GATES = [
  { id: 'filesize',     name: 'File Size',           emoji: '📁' },
  { id: 'architecture', name: 'Architecture',        emoji: '🏗️'  },
  { id: 'format',       name: 'Format (Prettier)',    emoji: '🎨' },
  { id: 'rsc',          name: 'RSC Directive',        emoji: '⚛️'  },
  { id: 'complexity',   name: 'Complexity',           emoji: '🧮' },
  { id: 'exports',      name: 'Export Count',         emoji: '📦' },
  { id: 'tokens',       name: 'Token Audit',          emoji: '🎯' },
  { id: 'manifest',     name: 'Manifest',             emoji: '📋' },
  { id: 'framework',    name: 'Framework Parity',     emoji: '🔗' },
  { id: 'size',         name: 'Bundle Size',          emoji: '📏' },
  { id: 'unused',       name: 'Unused Exports',       emoji: '🗑️'  },
  { id: 'circular',     name: 'Circular Imports',     emoji: '🔄' },
]

export async function run(opts = {}) {
  const args = process.argv.slice(3)
  const outputPath = args.includes('--output') ? args[args.indexOf('--output') + 1] : resolve(ROOT, 'dashboard.html')
  const openBrowser = args.includes('--open')

  const cfg = getConfig()
  const results = []

  console.log('Running gates for dashboard...\n')

  for (const gate of GATES) {
    process.stdout.write(`  ${gate.emoji} ${gate.name.padEnd(22)} `)
    const start = Date.now()

    try {
      execSync(`node cli.mjs check-${gate.id}`, { cwd: ROOT, stdio: 'pipe', timeout: 30000 })
      const ms = Date.now() - start
      results.push({ ...gate, status: 'pass', ms })
      console.log(`✓ ${ms}ms`)
    } catch (err) {
      const ms = Date.now() - start
      const status = ms >= 30000 ? 'timeout' : 'fail'
      results.push({ ...gate, status, ms })
      console.log(`✗ ${ms}ms`)
    }
  }

  // Generate HTML
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const timedOut = results.filter(r => r.status === 'timeout').length
  const pct = ((passed / results.length) * 100).toFixed(0)

  const rows = results.map(r => {
    const icon = r.status === 'pass' ? '✅' : r.status === 'timeout' ? '⏰' : '❌'
    const barPct = Math.min((r.ms / 10000) * 100, 100)
    return `
    <tr>
      <td class="status-cell status-${r.status}">${icon}</td>
      <td>${r.emoji} ${r.name}</td>
      <td class="status-${r.status}">${r.status.toUpperCase()}</td>
      <td>
        <div class="bar-container">
          <div class="bar bar-${r.status}" style="width: ${barPct}%"></div>
        </div>
        <span class="ms">${r.ms}ms</span>
      </td>
    </tr>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Iris UI — Engineering Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 40px; }
  .container { max-width: 800px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 8px; color: #f0f6fc; }
  .subtitle { color: #8b949e; margin-bottom: 24px; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; }
  .summary-card { flex: 1; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; text-align: center; }
  .summary-card .count { font-size: 32px; font-weight: bold; }
  .summary-card .label { font-size: 12px; color: #8b949e; margin-top: 4px; }
  .count-pass { color: #3fb950; }
  .count-fail { color: #f85149; }
  .count-timeout { color: #d29922; }
  table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
  th { text-align: left; padding: 12px 16px; background: #21262d; border-bottom: 1px solid #30363d; font-size: 12px; text-transform: uppercase; color: #8b949e; }
  td { padding: 12px 16px; border-bottom: 1px solid #21262d; }
  tr:last-child td { border-bottom: none; }
  .status-pass { color: #3fb950; }
  .status-fail { color: #f85149; }
  .status-timeout { color: #d29922; }
  .bar-container { display: inline-block; width: 120px; height: 8px; background: #21262d; border-radius: 4px; vertical-align: middle; overflow: hidden; }
  .bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .bar-pass { background: #3fb950; }
  .bar-fail { background: #f85149; }
  .bar-timeout { background: #d29922; }
  .ms { margin-left: 8px; font-size: 12px; color: #8b949e; }
  .footer { margin-top: 24px; font-size: 12px; color: #484f58; text-align: center; }
  .status-cell { text-align: center; width: 40px; }
</style>
</head>
<body>
<div class="container">
  <h1>🛡️ Iris UI Engineering Dashboard</h1>
  <p class="subtitle">${cfg.project.name} · ${new Date().toISOString().slice(0, 10)} · ${results.length} gates</p>

  <div class="summary">
    <div class="summary-card">
      <div class="count count-pass">${passed}</div>
      <div class="label">Passed</div>
    </div>
    <div class="summary-card">
      <div class="count count-fail">${failed}</div>
      <div class="label">Failed</div>
    </div>
    <div class="summary-card">
      <div class="count count-timeout">${timedOut}</div>
      <div class="label">Timeout</div>
    </div>
    <div class="summary-card">
      <div class="count ${pct >= 80 ? 'count-pass' : 'count-fail'}">${pct}%</div>
      <div class="label">Pass Rate</div>
    </div>
  </div>

  <table>
    <thead><tr><th></th><th>Gate</th><th>Status</th><th>Duration</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    Generated by node cli.mjs dashboard · ${new Date().toISOString()}
  </div>
</div>
</body>
</html>`

  writeFileSync(outputPath, html)
  console.log(`\n✅ Dashboard written to ${outputPath}\n`)

  if (openBrowser) {
    try {
      execSync(`open "${outputPath}" 2>/dev/null || xdg-open "${outputPath}" 2>/dev/null || start "${outputPath}" 2>/dev/null`, { stdio: 'pipe' })
    } catch { /* browser open not available */ }
  }

  return failed > 0 ? 1 : 0
}