#!/usr/bin/env node

/**
 * pnpm audit:tokens
 *
 * Scans all 4 framework adapter directories for `var(--iris-*)` usage,
 * compares against the canonical token set, and reports:
 *   1. Tokens used but NOT defined in @iris-ui-kit/tokens
 *   2. Per-framework token coverage gaps
 *   3. Single-framework-only tokens (potential copy-paste drift)
 *
 * Exit code:
 *   0 — clean (no unknowns, no drift above threshold)
 *   1 — warnings (minor drift / unknown tokens)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Known token set (parsed from @iris-ui-kit/tokens) ──────────────────────────
const TOKENS_DIR = path.join(ROOT, 'packages/tokens/src')

function extractDotTokens(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const matches = content.matchAll(/iris\.[a-z0-9.]+/g)
    return [...matches].map(function(m) { return m[0] })
  } catch {
    return []
  }
}

const knownDot = new Set([
  ...extractDotTokens(path.join(TOKENS_DIR, 'light.ts')),
  ...extractDotTokens(path.join(TOKENS_DIR, 'dark.ts')),
].sort())

// iris.gap.sm -> --iris-gap-sm
const knownCss = new Set(
  [...knownDot].map(function(t) { return '--' + t.replace(/\./g, '-') })
)

// ── Reviewed exceptions ─────────────────────────────────────────────────────
// CSS vars that are structurally single-framework or component-local, not
// unported design tokens. Reviewed 2026-07-02; re-audit if the underlying
// component changes.
const KNOWN_EXCEPTIONS = {
  '--iris-breadcrumb-sep': 'Svelte-only implementation detail: a per-instance ' +
    'CSS custom property feeding a static ::before{content} rule. React/Vue/' +
    'Solid render the separator as a real DOM node instead — not a themeable token.',
  '--iris-masonry-gap': 'Formally a token (iris.masonry.gap), but only Svelte ' +
    'needs the CSS-var indirection to pipe its `gap` prop into a scoped ' +
    '<style> block; React/Vue/Solid bind the prop directly via inline JS ' +
    'styles, so they never reference the var by name.',
  '--iris-primary-ghost': 'Pre-existing Solid-only choice: IrisTree tints the ' +
    'selected row with a translucent primary wash, while React/Vue/Svelte ' +
    'fill it solid. A real cross-framework visual divergence, tracked here ' +
    'rather than silently flagged — unifying it is a deliberate design call, ' +
    'not a token-porting fix.',
}

// ── Framework adapter directories ──────────────────────────────────────────
const FRAMEWORKS = {
  react:  path.join(ROOT, 'packages/react/src/primitives'),
  vue:    path.join(ROOT, 'packages/vue/src/primitives'),
  solid:  path.join(ROOT, 'packages/solid/src/primitives'),
  svelte: path.join(ROOT, 'packages/svelte/src/primitives'),
}

const FRAMEWORK_LABEL = { react: 'React', vue: 'Vue', solid: 'Solid', svelte: 'Svelte' }

// ── Helpers ────────────────────────────────────────────────────────────────

function walkDir(dir) {
  var files = []
  try {
    for (var entry of fs.readdirSync(dir, { withFileTypes: true })) {
      var full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files = files.concat(walkDir(full))
      } else if (/\.(ts|tsx|vue|svelte)$/.test(entry.name)) {
        files.push(full)
      }
    }
  } catch (e) {
    // dir doesn't exist
  }
  return files
}

function extractCssVars(content) {
  var tokens = new Set()
  var matches = content.matchAll(/var\((--iris-[a-z0-9-]+)/g)
  for (var m of matches) tokens.add(m[1])
  return tokens
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('  Token Usage Audit')
  console.log('')

  // Collect per-framework tokens
  var perFramework = {}
  var totalFiles = 0
  for (var fw in FRAMEWORKS) {
    var dir = FRAMEWORKS[fw]
    var files = walkDir(dir)
    var tokenSet = new Set()
    for (var file of files) {
      var content = fs.readFileSync(file, 'utf-8')
      var tokens = extractCssVars(content)
      for (var t of tokens) tokenSet.add(t)
    }
    perFramework[fw] = tokenSet
    totalFiles += files.length
    console.log(
      '  ' + FRAMEWORK_LABEL[fw].padEnd(8) +
      String(tokenSet.size).padStart(3) + ' unique tokens across ' +
      String(files.length).padStart(4) + ' files'
    )
  }

  // Union of all framework tokens, minus reviewed exceptions (gated below).
  var allTokens = new Set()
  for (var fw in perFramework) {
    for (var t of perFramework[fw]) allTokens.add(t)
  }
  var exceptionsSeen = [...allTokens].filter(function(t) { return t in KNOWN_EXCEPTIONS }).sort()
  for (var ex of exceptionsSeen) allTokens.delete(ex)

  var exitCode = 0

  // 1. Tokens used but NOT defined in @iris-ui-kit/tokens
  var unknownTokens = [...allTokens].filter(function(t) { return !knownCss.has(t) })
  unknownTokens.sort()

  if (unknownTokens.length > 0) {
    console.log('')
    console.log('  WARNING: ' + unknownTokens.length + ' token(s) used in adapters but NOT defined in @iris-ui-kit/tokens:')
    console.log('')
    for (var t of unknownTokens) {
      var frameworksUsing = []
      for (var fw in perFramework) {
        if (perFramework[fw].has(t)) frameworksUsing.push(FRAMEWORK_LABEL[fw])
      }
      console.log('    ' + t.padEnd(32) + ' used by: ' + frameworksUsing.join(', '))
    }
    console.log('')
    console.log('  These may be component-local custom properties. If they should be themeable,')
    console.log('  add them to @iris-ui-kit/tokens.')
    exitCode = 1
  } else {
    console.log('')
    console.log('  All ' + allTokens.size + ' tokens are defined in @iris-ui-kit/tokens.')
  }

  // 2. Per-framework coverage
  console.log('')
  console.log('  -- Per-framework coverage ----------------------------------------')
  console.log('')
  var hasDrift = false
  for (var fw in perFramework) {
    var set = perFramework[fw]
    var missing = [...allTokens].filter(function(t) { return !set.has(t) })
    if (missing.length === 0) {
      console.log('  ' + FRAMEWORK_LABEL[fw] + ': full coverage')
    } else {
      hasDrift = true
      console.log('  ' + FRAMEWORK_LABEL[fw] + ': missing ' + missing.length + ' token(s):')
      for (var t of missing.sort()) {
        var others = []
        for (var ofw in perFramework) {
          if (ofw !== fw && perFramework[ofw].has(t)) others.push(FRAMEWORK_LABEL[ofw])
        }
        console.log('    ' + t.padEnd(32) + ' present in: ' + others.join(', '))
      }
    }
  }

  if (hasDrift) {
    console.log('')
    console.log('  Drift indicates a token was introduced in one framework adapter')
    console.log('  but not ported to others. Check component files that reference these.')
    if (exitCode === 0) exitCode = 1
  } else {
    console.log('')
    console.log('  No cross-framework drift detected.')
  }

  // 3. Single-framework-only tokens
  console.log('')
  console.log('  -- Single-framework-only tokens ----------------------------------')
  console.log('')
  var singleCount = 0
  for (var fw in perFramework) {
    var fwSet = perFramework[fw]
    var unique = [...fwSet].filter(function(t) {
      if (t in KNOWN_EXCEPTIONS) return false
      for (var ofw in perFramework) {
        if (ofw !== fw && perFramework[ofw].has(t)) return false
      }
      return true
    })
    if (unique.length > 0) {
      singleCount += unique.length
      for (var t of unique.sort()) {
        console.log('    ' + t.padEnd(32) + ' only in ' + FRAMEWORK_LABEL[fw])
      }
    }
  }
  if (singleCount === 0) {
    console.log('  None - every token used by at least 2 frameworks.')
  } else {
    console.log('')
    console.log('  May be component-specific tokens. Verify intentional.')
  }

  // 4. Reviewed exceptions (informational only, never gates the exit code)
  if (exceptionsSeen.length > 0) {
    console.log('')
    console.log('  -- Reviewed exceptions (informational, not gated) -----------------')
    console.log('')
    for (var ex2 of exceptionsSeen) {
      console.log('    ' + ex2.padEnd(32) + ' ' + KNOWN_EXCEPTIONS[ex2])
    }
  }

  console.log('')
  console.log(exitCode === 0 ? '  Audit clean (exit 0)' : '  Audit warnings (exit 1)')
  console.log('')
  process.exit(exitCode)
}

main()
