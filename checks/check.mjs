#!/usr/bin/env node

/**
 * checks/check.mjs — Quick check.
 * Runs filesize + architecture + format as a fast pre-submit check.
 */

export async function run(opts = {}) {
  console.log('=== Iris UI Quick Check ===\n')

  const { run: filesize } = await import('./filesize.mjs')
  const { run: architecture } = await import('./architecture.mjs')
  const { run: format } = await import('./format.mjs')

  const ec1 = await filesize(opts)
  const ec2 = await architecture(opts)
  const ec3 = await format()

  const total = ec1 + ec2 + ec3

  if (total > 0) {
    console.log(`\n❌ QUICK CHECK FAILED (${total} gate(s) with issues)\n`)
    return 1
  }

  console.log('\n✅ QUICK CHECK PASSED\n')
  return 0
}