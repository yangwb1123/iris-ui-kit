#!/usr/bin/env node

/**
 * checks/rsc.mjs — RSC 'use client' directive gate.
 *
 * Ensures every JS entry in @iris-ui-kit/react/dist starts with the 'use client'
 * directive so the package is safe for Next.js App Router Server Components.
 *
 * Migration from scripts/check-rsc-directive.mjs.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

const DIRECTIVE = /^['"]use client['"];?/

export async function run() {
  const cfg = getConfig()
  const distDir = resolve(ROOT, cfg.rsc.check_dir)

  let files
  try {
    files = readdirSync(distDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'))
  } catch {
    console.error(`✗ ${distDir} not found — run \`pnpm turbo run build\` first.`)
    return 1
  }

  const offenders = []
  for (const f of files) {
    const head = readFileSync(resolve(distDir, f), 'utf8').slice(0, 64).trimStart()
    if (!DIRECTIVE.test(head)) offenders.push(f)
  }

  const fw = cfg.rsc.framework_name
  console.log(`\nRSC 'use client' directive (@iris-ui-kit/${fw})\n` + '─'.repeat(48))
  console.log(`${files.length} JS entries scanned, ${offenders.length} missing`)

  if (offenders.length) {
    console.error('\n✗ Missing the directive:\n' + offenders.map(f => `  - ${f}`).join('\n'))
    console.error('\nEnsure tsup.config.ts sets `banner: { js: "\'use client\'" }`.\n')
    return 1
  }

  console.log(`\n✓ All @iris-ui-kit/${fw} entries are client-boundary safe\n`)
  return 0
}