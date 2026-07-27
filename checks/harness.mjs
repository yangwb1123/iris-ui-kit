#!/usr/bin/env node

/**
 * checks/harness.mjs — Core engineering gates.
 *
 * Runs the three core gates: filesize + complexity + architecture.
 * Similar to snaplink's harness command.
 *
 * Run: node cli.mjs harness
 */

export async function run(opts = {}) {
  console.log('=== Iris UI Engineering Harness ===\n')

  const { run: filesize } = await import('./filesize.mjs')
  const { run: complexity } = await import('./complexity.mjs')
  const { run: architecture } = await import('./architecture.mjs')

  const ec1 = await filesize(opts)
  const ec2 = await complexity(opts)
  const ec3 = await architecture(opts)

  const total = ec1 + ec2 + ec3
  console.log('═'.repeat(48))

  if (total > 0) {
    console.log(`\n❌ HARNESS FAILED (${total} gate(s) with issues)\n`)
    return 1
  }

  console.log('\n✅ HARNESS PASSED\n')
  return 0
}