#!/usr/bin/env node
/* global console */

/**
 * pnpm audit:tokens
 *
 * Scans primitives, layouts, admin shells and optional plugins for
 * `var(--iris-*)` usage, compares against the canonical token set, and reports:
 *   1. Tokens used but NOT defined in @iris-ui-kit/tokens
 *   2. Per-framework token coverage gaps
 *   3. Single-framework-only tokens (potential copy-paste drift)
 *   4. Legacy token aliases that must be migrated to canonical names
 *
 * Exit code:
 *   0 — clean (no unknowns, no drift above threshold)
 *   1 — warnings (minor drift / unknown tokens)
 */

import fs from 'node:fs'
import path from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Known token set (parsed from @iris-ui-kit/tokens) ──────────────────────────
const TOKENS_DIR = path.join(ROOT, 'packages/tokens/src')

function extractDotTokens(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const matches = content.matchAll(/iris\.[A-Za-z0-9.]+/g)
    return [...matches].map(function (m) {
      return m[0]
    })
  } catch {
    return []
  }
}

const knownDot = new Set(
  [
    ...extractDotTokens(path.join(TOKENS_DIR, 'tokens.ts')),
    ...extractDotTokens(path.join(TOKENS_DIR, 'light.ts')),
    ...extractDotTokens(path.join(TOKENS_DIR, 'dark.ts')),
    // themeCssVarEntries derives these tonal values at runtime.
    'iris.primary.subtle',
    'iris.success.subtle',
    'iris.warning.subtle',
  ].sort(),
)

// iris.gap.sm -> --iris-gap-sm
const knownCss = new Set(
  [...knownDot].map(function (t) {
    return '--' + t.replace(/\./g, '-')
  }),
)

// ── Reviewed exceptions ─────────────────────────────────────────────────────
// CSS vars that are structurally single-framework or component-local, not
// unported design tokens. Reviewed 2026-07-02; re-audit if the underlying
// component changes.
const KNOWN_EXCEPTIONS = {
  '--iris-breadcrumb-sep':
    'Svelte-only implementation detail: a per-instance ' +
    'CSS custom property feeding a static ::before{content} rule. React/Vue/' +
    'Solid render the separator as a real DOM node instead — not a themeable token.',
  '--iris-masonry-gap':
    'Formally a token (iris.masonry.gap), but only Svelte ' +
    'needs the CSS-var indirection to pipe its `gap` prop into a scoped ' +
    '<style> block; React/Vue/Solid bind the prop directly via inline JS ' +
    'styles, so they never reference the var by name.',
  '--iris-nav-indent-step':
    'Vue admin scoped style variable (packages/vue/src/admin/styles.ts) ' +
    'feeding the NavMenu indent step; component-local, not a design token.',
  '--iris-nav-item-border-radius':
    'Vue admin scoped style variable (NavMenu item radius); component-local.',
  '--iris-nav-item-height':
    'Vue admin scoped style variable (NavMenu item height 34px); component-local.',
  '--iris-nav-item-hover':
    'Vue admin scoped style variable (NavMenu hover surface); component-local.',
  '--iris-nav-item-padding-block':
    'Vue admin scoped style variable (NavMenu block padding); component-local.',
  '--iris-nav-item-padding-inline':
    'Vue admin scoped style variable (NavMenu inline padding); component-local.',
  '--iris-nav-item-padding-inline-start':
    'Vue admin scoped style variable (NavMenu inline-start padding); component-local.',
  '--iris-focus-ring':
    'Vue tabs/admin scoped style variable (focus outline color alias of ' +
    '--iris-primary); component-local, not a themeable token.',
  '--iris-ring':
    'Vue admin scoped style variable (focus outline alias of --iris-primary); ' +
    'component-local.',
  '--iris-mask':
    'Svelte Tour scoped style variable (overlay mask rgba(0,0,0,0.45)); ' +
    'component-local, not a themeable token.',
  '--iris-primary-ghost':
    'Pre-existing Solid-only choice: IrisTree tints the ' +
    'selected row with a translucent primary wash, while React/Vue/Svelte ' +
    'fill it solid. A real cross-framework visual divergence, tracked here ' +
    'rather than silently flagged — unifying it is a deliberate design call, ' +
    'not a token-porting fix.',
}

// Runtime-injected variables (defined in component-injected stylesheets
// or the tokens theme surface), reviewed 2026-08-07:
//   --iris-anim-*       floating entrance animations (floating/animations.ts)
//   --iris-cell-bg      Table row hover/selected (--iris-cell-bg var)
//   --iris-row-bg       Table row hover (solid/svelte)
//   --iris-letter-spacing-wide  theme token (iris.font.letter.spacing.wide)
// Cross-framework drift exemptions (reviewed 2026-08-07):
//   --iris-anim-*     animation CSS vars: react consumes via ANIM_* constants
//                     (defined in floating/animations.ts), vue/svelte inline —
//                     same runtime surface, different spelling in source.
//   --iris-row-bg     Table hover var (solid/svelte use row-level, react/vue
//                     cell-level --iris-cell-bg) — same feature, different
//                     architecture.
//   --iris-font-size-base  compatibility token retained for published API;
//                     consumers migrated to md (P13 typography).
//   --iris-space-2xl+ space scale tokens consumed on demand by components;
//                     absence in a framework = not yet needed, not a defect.
const DRIFT_EXEMPT = new Set([
  '--iris-anim-dialog', '--iris-anim-popover', '--iris-anim-toast',
  '--iris-anim-tooltip', '--iris-cell-bg', '--iris-row-bg',
  '--iris-font-size-base', '--iris-z-modal', '--iris-z-popover',
  '--iris-z-toast', '--iris-z-tooltip', '--iris-space-2xl', '--iris-space-3xl',
  '--iris-space-4xl', '--iris-space-5xl',
])

const RUNTIME_INJECTED_VARS = new Set([
  '--iris-anim-dialog', '--iris-anim-popover', '--iris-anim-toast',
  '--iris-anim-tooltip', '--iris-cell-bg', '--iris-row-bg',
  '--iris-letter-spacing-wide',
])

const LEGACY_TOKEN_PREFIXES = ['--iris-color-']
const LEGACY_TOKEN_NAMES = new Set([
  '--iris-font-body',
  '--iris-primary-muted',
  '--iris-surface-alt',
  '--iris-chip-bg',
])

function isLegacyToken(token) {
  return (
    LEGACY_TOKEN_NAMES.has(token) ||
    LEGACY_TOKEN_PREFIXES.some(function (prefix) {
      return token.startsWith(prefix)
    })
  )
}

// ── Framework adapter directories ──────────────────────────────────────────
const FRAMEWORKS = {
  react: ['primitives', 'layouts', 'admin'].map(function (dir) {
    return path.join(ROOT, 'packages/react/src', dir)
  }),
  vue: ['primitives', 'layouts', 'admin'].map(function (dir) {
    return path.join(ROOT, 'packages/vue/src', dir)
  }),
  solid: ['primitives', 'layouts', 'admin'].map(function (dir) {
    return path.join(ROOT, 'packages/solid/src', dir)
  }),
  svelte: ['primitives', 'layouts', 'admin'].map(function (dir) {
    return path.join(ROOT, 'packages/svelte/src', dir)
  }),
}

const FRAMEWORK_LABEL = { react: 'React', vue: 'Vue', solid: 'Solid', svelte: 'Svelte' }

// ── Helpers ────────────────────────────────────────────────────────────────

function walkDir(dir) {
  let files = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files = files.concat(walkDir(full))
      } else if (/\.(ts|tsx|vue|svelte)$/.test(entry.name)) {
        if (/\.(test|spec)\./.test(entry.name)) continue
        files.push(full)
      }
    }
  } catch {
    // dir doesn't exist
  }
  return files
}

function extractCssVars(content) {
  const tokens = new Set()
  const source = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  // Requiring `,` or `)` after the name deliberately skips dynamic templates
  // such as `var(--iris-chart-${kind})`; their concrete registered tokens are
  // audited separately.
  const matches = source.matchAll(/var\(\s*(--iris-[A-Za-z0-9_-]+)\s*(?=[,)])/g)
  for (const match of matches) tokens.add(match[1])
  return tokens
}

function extractDeclaredCssVars(content) {
  const tokens = new Set()
  // Plugin tokens are statically registered from object literals. Treat those
  // namespaced declarations as valid extension points without weakening the
  // canonical check for arbitrary var() typos.
  const source = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const matches = source.matchAll(/['"](--iris-[A-Za-z0-9_-]+)['"]\s*:/g)
  for (const match of matches) tokens.add(match[1])
  return tokens
}

function collectFiles(dirs) {
  let files = []
  for (const dir of dirs) files = files.concat(walkDir(dir))
  return files
}

function collectTokens(files) {
  const tokens = new Set()
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    for (const token of extractCssVars(content)) tokens.add(token)
  }
  return tokens
}

function discoverPluginSourceDirs() {
  const packagesDir = path.join(ROOT, 'packages')
  try {
    return fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter(function (entry) {
        return entry.isDirectory() && entry.name.startsWith('plugin-')
      })
      .map(function (entry) {
        return {
          name: entry.name,
          dir: path.join(packagesDir, entry.name, 'src'),
        }
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name)
      })
  } catch {
    return []
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('  Token Usage Audit')
  console.log('')

  // Collect per-framework tokens
  const perFramework = {}
  for (const frameworkName in FRAMEWORKS) {
    const files = collectFiles(FRAMEWORKS[frameworkName])
    const tokenSet = collectTokens(files)
    perFramework[frameworkName] = tokenSet
    console.log(
      '  ' +
        FRAMEWORK_LABEL[frameworkName].padEnd(8) +
        String(tokenSet.size).padStart(3) +
        ' unique tokens across ' +
        String(files.length).padStart(4) +
        ' files',
    )
  }

  // Union of framework tokens. Reviewed exceptions are removed only from the
  // parity gate below; they remain visible in the informational section.
  const frameworkTokens = new Set()
  for (const frameworkName in perFramework) {
    for (const token of perFramework[frameworkName]) frameworkTokens.add(token)
  }

  // Plugins are extension namespaces: a `--iris-foo-*` reference is valid only
  // when a plugin statically declares it in a token object. This avoids both
  // false positives for legitimate plugin tokens and blanket prefix exemptions
  // that would hide spelling errors.
  const perPlugin = {}
  const pluginTokens = new Set()
  const declaredPluginTokens = new Set()
  let pluginFiles = 0
  for (const plugin of discoverPluginSourceDirs()) {
    const pluginSourceFiles = walkDir(plugin.dir)
    const tokens = collectTokens(pluginSourceFiles)
    for (const pluginSourceFile of pluginSourceFiles) {
      const content = fs.readFileSync(pluginSourceFile, 'utf-8')
      for (const declared of extractDeclaredCssVars(content)) {
        declaredPluginTokens.add(declared)
      }
    }
    perPlugin[plugin.name] = tokens
    pluginFiles += pluginSourceFiles.length
    for (const token of tokens) pluginTokens.add(token)
  }
  console.log(
    '  Plugins  ' +
      String(pluginTokens.size).padStart(3) +
      ' unique tokens across ' +
      String(pluginFiles).padStart(4) +
      ' files (' +
      String(Object.keys(perPlugin).length) +
      ' packages, ' +
      String(declaredPluginTokens.size) +
      ' declared extension tokens)',
  )

  const auditedTokens = new Set([...frameworkTokens, ...pluginTokens])
  const exceptionsSeen = [...auditedTokens]
    .filter(function (t) {
      return t in KNOWN_EXCEPTIONS
    })
    .sort()
  const parityTokens = new Set(frameworkTokens)
  for (const exception of exceptionsSeen) parityTokens.delete(exception)

  let exitCode = 0

  // 1. Tokens used but NOT defined in @iris-ui-kit/tokens
  const unknownTokens = [...auditedTokens].filter(function (t) {
    if (t in KNOWN_EXCEPTIONS) return false
    if (isLegacyToken(t)) return true
    if (RUNTIME_INJECTED_VARS.has(t)) return false
    return !knownCss.has(t) && !declaredPluginTokens.has(t)
  })
  unknownTokens.sort()

  if (unknownTokens.length > 0) {
    console.log('')
    console.log(
      '  WARNING: ' +
        unknownTokens.length +
        ' unknown or legacy token(s) used in adapters/plugins:',
    )
    console.log('')
    for (const token of unknownTokens) {
      const scopesUsing = []
      for (const frameworkName in perFramework) {
        if (perFramework[frameworkName].has(token)) {
          scopesUsing.push(FRAMEWORK_LABEL[frameworkName])
        }
      }
      for (const pluginName in perPlugin) {
        if (perPlugin[pluginName].has(token)) scopesUsing.push(pluginName)
      }
      console.log('    ' + token.padEnd(32) + ' used by: ' + scopesUsing.join(', '))
    }
    console.log('')
    console.log('  Add canonical tokens to @iris-ui-kit/tokens, declare namespaced plugin')
    console.log('  extension tokens, or migrate legacy aliases to canonical names.')
    exitCode = 1
  } else {
    console.log('')
    console.log(
      '  All ' + auditedTokens.size + ' usages resolve to canonical or declared plugin tokens.',
    )
  }

  // 2. Per-framework coverage
  console.log('')
  console.log('  -- Per-framework coverage ----------------------------------------')
  console.log('')
  let hasDrift = false
  for (const frameworkName in perFramework) {
    const set = perFramework[frameworkName]
    const missing = [...parityTokens].filter(function (t) {
      if (DRIFT_EXEMPT.has(t)) return false
      return !set.has(t)
    })
    if (missing.length === 0) {
      console.log('  ' + FRAMEWORK_LABEL[frameworkName] + ': full coverage')
    } else {
      hasDrift = true
      console.log(
        '  ' + FRAMEWORK_LABEL[frameworkName] + ': missing ' + missing.length + ' token(s):',
      )
      for (const missingToken of missing.sort()) {
        const others = []
        for (const otherFramework in perFramework) {
          if (otherFramework !== frameworkName && perFramework[otherFramework].has(missingToken)) {
            others.push(FRAMEWORK_LABEL[otherFramework])
          }
        }
        console.log('    ' + missingToken.padEnd(32) + ' present in: ' + others.join(', '))
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
  let singleCount = 0
  for (const frameworkName in perFramework) {
    const frameworkSet = perFramework[frameworkName]
    const unique = [...frameworkSet].filter(function (t) {
      if (t in KNOWN_EXCEPTIONS) return false
      for (const otherFramework in perFramework) {
        if (otherFramework !== frameworkName && perFramework[otherFramework].has(t)) {
          return false
        }
      }
      return true
    })
    if (unique.length > 0) {
      singleCount += unique.length
      for (const token of unique.sort()) {
        console.log('    ' + token.padEnd(32) + ' only in ' + FRAMEWORK_LABEL[frameworkName])
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
    for (const exception of exceptionsSeen) {
      console.log('    ' + exception.padEnd(32) + ' ' + KNOWN_EXCEPTIONS[exception])
    }
  }

  console.log('')
  console.log(exitCode === 0 ? '  Audit clean (exit 0)' : '  Audit warnings (exit 1)')
  console.log('')
  exit(exitCode)
}

main()
