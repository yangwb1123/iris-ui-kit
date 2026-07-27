#!/usr/bin/env node
/* global console */

/**
 * `svelte-package` intentionally copies every source file. Tests, contract
 * harnesses, probes, and demos are useful in `src/` but are not public runtime
 * artifacts and must not be shipped in npm tarballs.
 *
 * Usage from a package directory:
 *   node ../../scripts/prune-package-dist.mjs dist
 *   node ../../scripts/prune-package-dist.mjs dist/svelte
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targets = process.argv.slice(2)

if (targets.length === 0) {
  throw new Error('prune-package-dist: provide at least one generated dist directory')
}

const removableDirectory = /^(?:__tests__|__ssr__|fixtures?|test)$/i
const removableFile = /(?:\.test\.|(?:Harness|Probe|Demo|ThrowingChild)\.)/i

function assertGeneratedDist(target) {
  const rel = relative(repoRoot, target)
  const parts = rel.split(sep)
  if (rel.startsWith('..') || rel === '' || !parts.includes('dist')) {
    throw new Error(`prune-package-dist: refusing unsafe target ${target}`)
  }
}

function pruneDirectory(dir) {
  let removed = 0
  if (!existsSync(dir)) return removed

  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (removableDirectory.test(name)) {
        rmSync(path, { recursive: true, force: true })
        removed += 1
      } else {
        removed += pruneDirectory(path)
        if (existsSync(path) && readdirSync(path).length === 0) rmSync(path, { recursive: true })
      }
    } else if (removableFile.test(name)) {
      rmSync(path, { force: true })
      removed += 1
    }
  }
  return removed
}

let total = 0
for (const input of targets) {
  const target = resolve(process.cwd(), input)
  assertGeneratedDist(target)
  total += pruneDirectory(target)
}

console.log(`prune-package-dist: removed ${total} non-runtime artifact${total === 1 ? '' : 's'}`)
