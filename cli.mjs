#!/usr/bin/env node

/**
 * iris-cli — Iris UI engineering CLI.
 *
 * Unified entry point for all engineering gates. Thresholds live in iris.yaml,
 * not hardcoded here.
 *
 * Usage:
 *   node cli.mjs <command> [options]
 *   node cli.mjs check-filesize --strict    # strict mode (ignore baseline)
 *   node cli.mjs generate                    # regenerate manifest
 *
 * Commands:
 *   generate            Regenerate engineering scaffolding (manifest, llms.txt)
 *   check               Quick check (filesize + architecture + format)
 *   check-filesize      File size gate (≤500 lines)
 *   check-architecture  Dependency direction gate (core ≠ framework)
 *   check-complexity    Cyclomatic/cognitive complexity gate
 *   check-exports       Symbol export count gate (God Object detection)
 *   check-size          Bundle size budget gate (gzip)
 *   check-coverage      Test coverage gate
 *   check-tokens        Token audit gate (CSS var vs token set)
 *   check-rsc           RSC 'use client' directive gate
 *   check-framework     Four-framework parity check
 *   check-manifest      Component manifest consistency
 *   check-parity        Desktop app parity check
 *   check-format        Prettier format check
 *   check-pack-install  External pack+npm-install smoke test
 *   change-budget       Change budget gate (AUTONOMOUS compliance)
 *   acceptance          Full acceptance suite
 *   harness             Core engineering gates (filesize + complexity + architecture)
 *   coverage            Run tests + coverage gate
 *   self-test           Test the check modules themselves
 *   help                Show this message
 */

import { argv, exit } from 'node:process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)))
const CONFIG_PATH = resolve(ROOT, 'iris.yaml')

// Verify iris.yaml exists
if (!existsSync(CONFIG_PATH)) {
  console.error(`ERROR: iris.yaml not found at ${CONFIG_PATH}`)
  console.error('Run from project root: node cli.mjs <command>')
  exit(1)
}

const HELP_TEXT = `
iris-cli — Iris UI engineering CLI

Usage: node cli.mjs <command> [options]

Commands:
  generate              Regenerate scaffolding (manifest, llms.txt)
  check                 Quick check (filesize + architecture + format)
  check-filesize        File size gate
  check-architecture    Dependency direction gate
  check-complexity      Complexity gate
  check-exports         Symbol export count gate
  check-size            Bundle size budget gate
  check-coverage        Test coverage gate
  check-tokens          Token audit
  check-rsc             RSC directive gate
  check-framework       Four-framework parity
  check-manifest        Manifest consistency
  check-parity          Desktop parity
  check-format          Prettier format check
  check-pack-install    Pack+install smoke test
  check-unused          Unused exports detection (ts-prune)
  check-circular        Circular import detection (madge)
  check-deps            Dependency version consistency & audit
  check-license         License header verification
  check-spelling        Spell check source files
  ci [--skip-*]         Run full CI pipeline locally
  change-budget         Change budget gate
  lint                  Run ESLint
  typecheck             Run TypeScript type check
  validate-config       Validate iris.yaml configuration
  fix <name>            Auto-fix common issues (format/manifest/tokens/all)
  monitor [check...]    Watch source directories and auto-re-run checks
  report [check...]     Run checks with JSON output (for CI/dashboards)
  changelog [--json]    Generate changelog from git log
  budget [--record]     Size budget dashboard & trend tracking
  dashboard [--open]    Generate HTML dashboard page
  diagnose              Environment diagnostics
  env-check             Prerequisite check
  progress              Progress dashboard (gate status summary)
  skill <name> [args]   Run an automation skill
  acceptance            Full acceptance suite
  harness               Core gates (filesize+complexity+architecture)
  coverage              Run tests + coverage gate
  self-test             Test check modules
  help                  Show this message

Options:
  --strict     Strict mode (ignore baselines)
  --ratchet    Ratchet mode (Δ-only failures)
  --diff       Diff mode (changed files only)
  --update-baseline  Update baseline file
  --verbose    Show detailed error stack traces

Examples:
  node cli.mjs check-filesize --strict
  node cli.mjs acceptance
  node cli.mjs check
`

const COMMANDS = {
  help: async () => { console.log(HELP_TEXT); return 0 },

  generate: async (opts) => {
    const { run } = await import('./checks/generate.mjs')
    return run(opts)
  },

  check: async (opts) => {
    const { run } = await import('./checks/check.mjs')
    return run(opts)
  },

  'check-filesize': async (opts) => {
    const { run } = await import('./checks/filesize.mjs')
    return run(opts)
  },

  'check-architecture': async (opts) => {
    const { run } = await import('./checks/architecture.mjs')
    return run(opts)
  },

  'check-complexity': async (opts) => {
    const { run } = await import('./checks/complexity.mjs')
    return run(opts)
  },

  'check-exports': async (opts) => {
    const { run } = await import('./checks/exports.mjs')
    return run(opts)
  },

  'check-size': async (opts) => {
    const { run } = await import('./checks/size.mjs')
    return run(opts)
  },

  'check-coverage': async (opts) => {
    const { run } = await import('./checks/coverage.mjs')
    return run(opts)
  },

  'check-tokens': async (opts) => {
    const { run } = await import('./checks/tokens.mjs')
    return run(opts)
  },

  'check-rsc': async (opts) => {
    const { run } = await import('./checks/rsc.mjs')
    return run(opts)
  },

  'check-framework': async (opts) => {
    const { run } = await import('./checks/framework-parity.mjs')
    return run(opts)
  },

  'check-manifest': async (opts) => {
    const { run } = await import('./checks/manifest.mjs')
    return run(opts)
  },

  'check-parity': async (opts) => {
    const { run } = await import('./checks/desktop-parity.mjs')
    return run(opts)
  },

  'check-format': async (opts) => {
    const { run } = await import('./checks/format.mjs')
    return run(opts)
  },

  'check-pack-install': async (opts) => {
    const { run } = await import('./checks/pack-install.mjs')
    return run(opts)
  },

  'check-unused': async (opts) => {
    const { run } = await import('./checks/unused-exports.mjs')
    return run(opts)
  },

  'check-circular': async (opts) => {
    const { run } = await import('./checks/circular-imports.mjs')
    return run(opts)
  },

  'check-deps': async (opts) => {
    const { run } = await import('./checks/deps.mjs')
    return run(opts)
  },

  'check-license': async (opts) => {
    const { run } = await import('./checks/license.mjs')
    return run(opts)
  },

  'check-spelling': async (opts) => {
    const { run } = await import('./checks/spelling.mjs')
    return run(opts)
  },

  ci: async (opts) => {
    const { run } = await import('./checks/ci.mjs')
    return run(opts)
  },

  lint: async (opts) => {
    const { execSync } = await import('node:child_process')
    console.log('--- ESLint ---\n')
    try {
      execSync('pnpm lint', { cwd: ROOT, stdio: 'inherit', timeout: 60000 })
      console.log('\n✓ Lint passed\n')
      return 0
    } catch {
      console.log('\n❌ Lint failed\n')
      return 1
    }
  },

  typecheck: async (opts) => {
    const { execSync } = await import('node:child_process')
    console.log('--- TypeScript Type Check ---\n')
    try {
      execSync('pnpm typecheck', { cwd: ROOT, stdio: 'inherit', timeout: 120000 })
      console.log('\n✓ Typecheck passed\n')
      return 0
    } catch {
      console.log('\n❌ Typecheck failed\n')
      return 1
    }
  },

  'validate-config': async (opts) => {
    const { run } = await import('./checks/validate-config.mjs')
    return run(opts)
  },

  fix: async (opts) => {
    const { run } = await import('./checks/fix.mjs')
    return run(opts)
  },

  monitor: async (opts) => {
    const { run } = await import('./checks/monitor.mjs')
    return run(opts)
  },

  report: async (opts) => {
    const { run } = await import('./checks/report.mjs')
    return run(opts)
  },

  changelog: async (opts) => {
    const { run } = await import('./checks/changelog.mjs')
    return run(opts)
  },

  budget: async (opts) => {
    const { run } = await import('./checks/budget.mjs')
    return run(opts)
  },

  dashboard: async (opts) => {
    const { run } = await import('./checks/dashboard.mjs')
    return run(opts)
  },

  diagnose: async (opts) => {
    const { run } = await import('./checks/diagnose.mjs')
    return run(opts)
  },

  'env-check': async (opts) => {
    const { run } = await import('./checks/env-check.mjs')
    return run(opts)
  },

  progress: async (opts) => {
    const { run } = await import('./checks/progress.mjs')
    return run(opts)
  },

  skill: async (opts) => {
    // skill takes extra positional args: node cli.mjs skill <name> [args...]
    const cmdArgs = process.argv.slice(3)
    const name = cmdArgs[0]
    if (!name || name.startsWith('--')) {
      console.error('Usage: node cli.mjs skill <name> [args...]')
      console.error('\nAvailable skills:')
      const { readdirSync, existsSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const skillsDir = resolve(ROOT, 'skills')
      if (existsSync(skillsDir)) {
        for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith('_')) {
            console.error(`  ${entry.name}`)
          }
        }
      }
      return 1
    }
    const skillArgs = cmdArgs.slice(1)
    const skillPath = resolve(ROOT, 'skills', name, 'run.mjs')
    const { existsSync } = await import('node:fs')
    if (!existsSync(skillPath)) {
      console.error(`Error: skill '${name}' not found at skills/${name}/run.mjs`)
      return 1
    }
    try {
      const mod = await import(skillPath)
      return await mod.run(skillArgs)
    } catch (err) {
      console.error(`Error running skill '${name}': ${err.message}`)
      return 1
    }
  },

  'change-budget': async (opts) => {
    const { run } = await import('./checks/change-budget.mjs')
    return run(opts)
  },

  acceptance: async (opts) => {
    const { run } = await import('./checks/acceptance.mjs')
    return run(opts)
  },

  harness: async (opts) => {
    const { run } = await import('./checks/harness.mjs')
    return run(opts)
  },

  coverage: async (opts) => {
    const { run } = await import('./checks/coverage.mjs')
    return run({ ...opts, runTests: true })
  },

  'self-test': async (opts) => {
    const { run } = await import('./checks/self_test.mjs')
    return run(opts)
  },
}

function parseOpts(args) {
  const opts = {
    strict: args.includes('--strict'),
    all: args.includes('--all'),
    ratchet: args.includes('--ratchet'),
    diff: args.includes('--diff'),
    updateBaseline: args.includes('--update-baseline'),
    enforce: args.includes('--enforce'),
    staged: args.includes('--staged'),
    verbose: args.includes('--verbose'),
  }
  return opts
}

async function main() {
  const cmd = argv[2] || 'help'
  const cmdArgs = argv.slice(3)

  if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    console.log(HELP_TEXT)
    return 0
  }

  if (!COMMANDS[cmd]) {
    console.error(`\n  Unknown command: '${cmd}'`)
    console.error(`  Use 'node cli.mjs help' for usage.\n`)
    return 1
  }

  const opts = parseOpts(cmdArgs)

  try {
    return await COMMANDS[cmd](opts)
  } catch (err) {
    console.error(`\n  ✗ Fatal error executing '${cmd}':`)
    console.error(`    ${err.message}\n`)
    if (opts.verbose || process.argv.includes('--verbose')) {
      console.error(err.stack)
    }
    return 1
  }
}

exit(await main())
