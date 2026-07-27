#!/usr/bin/env node

/**
 * checks/tokens.mjs — Token usage audit.
 *
 * Scans all four framework adapters for `var(--iris-*)` usage, compares against
 * the canonical token set in @iris-ui-kit/tokens, and reports:
 *   1. Unknown tokens (used but not defined)
 *   2. Per-framework coverage gaps
 *   3. Single-framework-only tokens (potential copy-paste drift)
 *
 * Migration from scripts/audit-tokens.mjs.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

const ALLOWED_EXTS = new Set(['.ts', '.tsx', '.vue', '.svelte'])

function walkDir(dir) {
  const files = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) files.push(...walkDir(full))
      else if (ALLOWED_EXTS.has(extname(entry.name))) files.push(full)
    }
  } catch { /* skip */ }
  return files
}

function extractCssVars(content) {
  const tokens = new Set()
  const matches = content.matchAll(/var\((--iris-[a-z0-9-]+)/g)
  for (const m of matches) tokens.add(m[1])
  return tokens
}

function extractDotTokens(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const matches = content.matchAll(/iris\.[a-z0-9.]+/g)
    return [...matches].map(m => m[0])
  } catch { return [] }
}

const LABELS = { react: 'React', vue: 'Vue', solid: 'Solid', svelte: 'Svelte' }

export async function run() {
  const cfg = getConfig()
  const tokensDir = resolve(ROOT, cfg.tokens.tokens_dir)

  // Build known token set from light.ts/dark.ts
  const knownDot = new Set()
  for (const src of cfg.tokens.token_source_files) {
    for (const t of extractDotTokens(resolve(tokensDir, src))) knownDot.add(t)
  }
  const knownCss = new Set([...knownDot].map(t => '--' + t.replace(/\./g, '-')))

  // Known exceptions (from the original audit-tokens.js)
  const KNOWN_EXCEPTIONS = {
    '--iris-breadcrumb-sep': 'Svelte-only: CSS custom property for ::before{content}',
    '--iris-masonry-gap': 'Svelte-only: needs CSS-var indirection for scoped <style>',
    '--iris-primary-ghost': 'Solid-only: translucent primary wash on tree selection',
  }

  // Scan each framework
  const frameworks = cfg.framework_parity.frameworks
  const perFramework = {}
  let totalFiles = 0

  console.log('  Token Usage Audit\n')

  for (const [fw, dir] of Object.entries(frameworks)) {
    const fullDir = resolve(ROOT, dir)
    const files = walkDir(fullDir)
    const tokenSet = new Set()

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const tokens = extractCssVars(content)
      for (const t of tokens) tokenSet.add(t)
    }

    perFramework[fw] = tokenSet
    totalFiles += files.length
    console.log(`  ${LABELS[fw].padEnd(8)} ${String(tokenSet.size).padStart(3)} unique tokens across ${String(files.length).padStart(4)} files`)
  }

  // Union minus exceptions
  const allTokens = new Set()
  for (const fw in perFramework) {
    for (const t of perFramework[fw]) allTokens.add(t)
  }
  const exceptionsSeen = [...allTokens].filter(t => t in KNOWN_EXCEPTIONS).sort()
  for (const ex of exceptionsSeen) allTokens.delete(ex)

  let exitCode = 0

  // 1. Unknown tokens
  const unknown = [...allTokens].filter(t => !knownCss.has(t)).sort()
  if (unknown.length > 0) {
    console.log(`\n  WARNING: ${unknown.length} token(s) used but NOT defined in @iris-ui-kit/tokens:\n`)
    for (const t of unknown) {
      const users = Object.entries(perFramework).filter(([, s]) => s.has(t)).map(([k]) => LABELS[k])
      console.log(`    ${t.padEnd(32)} used by: ${users.join(', ')}`)
    }
    exitCode = 1
  } else {
    console.log(`\n  All ${allTokens.size} tokens are defined in @iris-ui-kit/tokens.`)
  }

  // 2. Per-framework coverage gaps
  console.log('\n  -- Per-framework coverage ----------------------------------------\n')
  let hasDrift = false
  for (const fw in perFramework) {
    const missing = [...allTokens].filter(t => !perFramework[fw].has(t))
    if (missing.length === 0) {
      console.log(`  ${LABELS[fw]}: full coverage`)
    } else {
      hasDrift = true
      console.log(`  ${LABELS[fw]}: missing ${missing.length} token(s):`)
      for (const t of missing.sort()) {
        const others = Object.entries(perFramework).filter(([k, s]) => k !== fw && s.has(t)).map(([k]) => LABELS[k])
        console.log(`    ${t.padEnd(32)} present in: ${others.join(', ')}`)
      }
    }
  }

  if (hasDrift && exitCode === 0) exitCode = 1

  // 3. Single-framework-only tokens
  console.log('\n  -- Single-framework-only tokens ----------------------------------\n')
  let singleCount = 0
  for (const fw in perFramework) {
    const unique = [...perFramework[fw]].filter(t => {
      if (t in KNOWN_EXCEPTIONS) return false
      return !Object.entries(perFramework).some(([k, s]) => k !== fw && s.has(t))
    })
    for (const t of unique.sort()) {
      singleCount++
      console.log(`    ${t.padEnd(32)} only in ${LABELS[fw]}`)
    }
  }
  if (singleCount === 0) console.log('  None — every token used by at least 2 frameworks.')

  // 4. Reviewed exceptions (informational)
  if (exceptionsSeen.length > 0) {
    console.log('\n  -- Reviewed exceptions (informational) ---------------------------\n')
    for (const ex of exceptionsSeen) {
      console.log(`    ${ex.padEnd(32)} ${KNOWN_EXCEPTIONS[ex]}`)
    }
  }

  console.log(`\n  ${exitCode === 0 ? 'Audit clean (exit 0)' : 'Audit warnings (exit 1)'}\n`)
  return exitCode
}