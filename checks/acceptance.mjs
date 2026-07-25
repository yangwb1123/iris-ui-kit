#!/usr/bin/env node

/**
 * checks/acceptance.mjs — Full acceptance suite.
 *
 * Orchestrates every engineering gate, reports pass/fail in real-time,
 * and exits with the aggregate result.
 *
 * Without --all: runs every gate (whether pass or fail).
 * With   --all: also runs advisory gates (manifest, tokens, exports, parity, coverage).
 */

export async function run(opts = {}) {
  const allMode = opts.all || opts.strict

  const gates = [
    { name: 'Filesize',                    fn: () => import('./filesize.mjs').then(m => m.run(opts)), required: true },
    { name: 'Architecture (no framework in core)', fn: () => import('./architecture.mjs').then(m => m.run(opts)), required: true },
    { name: 'RSC Directive',               fn: () => import('./rsc.mjs').then(m => m.run()), required: true },
    { name: 'Format (packages/)',          fn: () => import('./format.mjs').then(m => m.run()), required: true },
    { name: 'Bundle Size',                 fn: () => import('./size.mjs').then(m => m.run(opts)), required: true },
    { name: 'Framework Parity',            fn: () => import('./framework-parity.mjs').then(m => m.run(opts)), required: true },
    { name: 'Change Budget',               fn: () => import('./change-budget.mjs').then(m => m.run(opts)), required: true },
    // Advisory gates (included by default, but not blocking in non-strict mode)
    { name: 'Complexity (advisory)',        fn: () => import('./complexity.mjs').then(m => m.run(opts)), required: allMode },
    { name: 'Exports (advisory)',           fn: () => import('./exports.mjs').then(m => m.run(opts)), required: allMode },
    { name: 'Token Audit',                  fn: () => import('./tokens.mjs').then(m => m.run(opts)), required: allMode },
    { name: 'Manifest Consistency',         fn: () => import('./manifest.mjs').then(m => m.run(opts)), required: allMode },
    { name: 'Desktop Parity',               fn: () => import('./desktop-parity.mjs').then(m => m.run(opts)), required: allMode },
    { name: 'Coverage Report',              fn: () => import('./coverage.mjs').then(m => m.run(opts)), required: allMode },
    { name: 'Pack+Install Smoke',            fn: () => import('./pack-install.mjs').then(m => m.run(opts)), required: allMode },
  ]

  console.log('═'.repeat(60))
  console.log('  Iris UI Acceptance Suite' + (allMode ? ' (full)' : ' (core gates)'))
  console.log('═'.repeat(60))
  console.log()

  let pass = 0
  let fail = 0
  let skip = 0
  let total = 0

  for (const gate of gates) {
    if (!gate.required) {
      console.log(`  ◐ ${gate.name.padEnd(42)} SKIP (use --all or --strict)`)
      skip++
      continue
    }
    total++
    process.stdout.write(`  ${gate.name.padEnd(42)} `)

    try {
      const ec = await gate.fn()
      if (ec === 0) {
        console.log('✓ PASS')
        pass++
      } else {
        console.log('✗ FAIL')
        fail++
      }
    } catch (err) {
      console.log(`✗ ERROR: ${err.message}`)
      fail++
    }

    console.log()
  }

  console.log('═'.repeat(60))

  if (skip > 0) {
    console.log(`  ${pass}/${total} gates passed (${skip} advisory skipped, use --all to include)`)
  } else {
    console.log(`  ${pass}/${total} gates passed`)
  }

  if (fail > 0) {
    console.log(`\n  ❌ ACCEPTANCE FAILED (${fail} failure(s))\n`)
    return 1
  }

  console.log('\n  ✅ ACCEPTANCE PASSED\n')
  return 0
}