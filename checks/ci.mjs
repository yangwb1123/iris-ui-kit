#!/usr/bin/env node

/**
 * checks/ci.mjs — Run the full CI pipeline locally.
 *
 * Simulates the GitHub Actions CI workflow: lint → typecheck → check gates → test.
 * Useful for pre-merge validation without pushing to CI.
 *
 * Usage: node cli.mjs ci [--skip-build] [--skip-tests] [--skip-e2e]
 */

import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'

const CYAN = (s) => `\x1b[36m${s}\x1b[0m`
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`
const RED = (s) => `\x1b[31m${s}\x1b[0m`
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`

export async function run(opts = {}) {
  const args = process.argv.slice(3)
  const skipBuild = args.includes('--skip-build')
  const skipTests = args.includes('--skip-tests')
  const skipE2e = args.includes('--skip-e2e')

  const steps = []

  // Phase 1: Prerequisites
  steps.push({ name: 'Environment Check', cmd: 'node cli.mjs env-check', critical: true })

  // Phase 2: Static analysis
  steps.push({ name: 'Format Check', cmd: 'node cli.mjs check-format', critical: true })
  steps.push({ name: 'Lint', cmd: 'pnpm lint', critical: true })
  steps.push({ name: 'TypeScript Check', cmd: 'pnpm typecheck', critical: true, timeout: 120000 })

  // Phase 3: Build
  if (!skipBuild) {
    steps.push({ name: 'Build', cmd: 'pnpm build', critical: true, timeout: 120000 })
    steps.push({ name: 'Bundle Size', cmd: 'node cli.mjs check-size', critical: true })
  }

  // Phase 4: Engineering gates
  steps.push({ name: 'Acceptance Suite', cmd: 'node cli.mjs acceptance', critical: true, timeout: 60000 })
  steps.push({ name: 'Unused Exports', cmd: 'node cli.mjs check-unused', critical: false })
  steps.push({ name: 'Circular Imports', cmd: 'node cli.mjs check-circular', critical: false, timeout: 60000 })

  // Phase 5: Tests
  if (!skipTests) {
    steps.push({ name: 'Unit Tests', cmd: 'pnpm test', critical: true, timeout: 120000 })
    steps.push({ name: 'Coverage', cmd: 'node cli.mjs check-coverage --enforce', critical: false })
  }

  // Phase 6: E2E
  if (!skipE2e) {
    steps.push({ name: 'E2E Smoke', cmd: 'cd apps/cms-react && npx playwright test e2e/smoke.spec.ts', critical: false, timeout: 120000 })
  }

  const cfg = getConfig()
  const startTime = Date.now()

  console.log()
  console.log(CYAN('═'.repeat(60)))
  console.log(CYAN(`  ${cfg.project.name} — Local CI Pipeline`))
  console.log(CYAN('═'.repeat(60)))
  console.log()

  let pass = 0
  let fail = 0
  let skip = 0

  for (const step of steps) {
    const isSkipped = !step.critical && (step.name.includes('E2E') && skipE2e)
    const label = `${step.name.padEnd(22)}`
    process.stdout.write(`  ${label} `)

    if (isSkipped) {
      console.log('◐ SKIP')
      skip++
      continue
    }

    const stepStart = Date.now()
    try {
      execSync(step.cmd, { cwd: ROOT, stdio: 'pipe', timeout: step.timeout || 30000 })
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
      console.log(`${GREEN('✓')} ${elapsed}s`)
      pass++
    } catch (err) {
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
      console.log(`${RED('✗')} ${elapsed}s`)

      // Show error output snippet
      const output = (err.stdout || err.stderr || '').toString().trim()
      if (output) {
        const lines = output.split('\n').slice(0, 3)
        for (const line of lines) {
          if (line.trim()) console.log(`    ${line.trim()}`)
        }
      }

      fail++
      if (step.critical) {
        console.log(`\n  ${RED('CRITICAL STEP FAILED — aborting pipeline')}\n`)
        break
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log()
  console.log(CYAN('═'.repeat(60)))
  console.log(`  ${pass} passed · ${fail} failed · ${skip} skipped · ${totalTime}s total`)

  if (fail > 0) {
    console.log(`\n  ${RED('❌ CI Pipeline FAILED')}\n`)
    return 1
  }

  console.log(`\n  ${GREEN('✅ CI Pipeline PASSED')}\n`)
  return 0
}