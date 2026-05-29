#!/usr/bin/env node
// RSC directive gate. Every emitted JS entry of @iris-ui/react must begin with
// the `'use client'` directive so the package (and every deep-import subpath)
// can be consumed directly inside a React Server Component — i.e. imported from
// a Next.js App Router Server Component without a manual client wrapper. The
// directive is injected by esbuild's banner (packages/react/tsup.config.ts);
// this is the tripwire that fails CI if that ever regresses. Run after build:
//
//   pnpm turbo run build && pnpm check:rsc
//
// Zero dependencies (node:fs). Scans every .js/.cjs file in the built dist
// (entries + shared chunks); .d.ts/.map are intentionally excluded.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(repoRoot, 'packages', 'react', 'dist')

// Matches a leading `'use client'` / `"use client"` directive (optional ;).
const DIRECTIVE = /^['"]use client['"];?/

let files
try {
  files = readdirSync(distDir).filter((f) => f.endsWith('.js') || f.endsWith('.cjs'))
} catch {
  // eslint-disable-next-line no-console
  console.error(`✗ ${distDir} not found — run \`pnpm turbo run build\` first.`)
  process.exit(1)
}

const offenders = []
for (const f of files) {
  const head = readFileSync(join(distDir, f), 'utf8').slice(0, 64).trimStart()
  if (!DIRECTIVE.test(head)) offenders.push(f)
}

// eslint-disable-next-line no-console
console.log("\nRSC 'use client' directive (@iris-ui/react)\n" + '─'.repeat(48))
// eslint-disable-next-line no-console
console.log(`${files.length} JS entr${files.length === 1 ? 'y' : 'ies'} scanned, ${offenders.length} missing`)

if (offenders.length) {
  // eslint-disable-next-line no-console
  console.error('\n✗ missing the directive:\n' + offenders.map((f) => '  - ' + f).join('\n'))
  // eslint-disable-next-line no-console
  console.error('\nEnsure tsup.config.ts sets `banner: { js: "\'use client\'" }`.\n')
  process.exit(1)
}

// eslint-disable-next-line no-console
console.log('\n✓ all React entries are client-boundary safe\n')
