#!/usr/bin/env node
// Post-build fixup for `svelte-package`'s dist output.
//
// `svelte-package` transpiles each .ts/.svelte file in isolation via
// `ts.transpileModule` (no cross-file module resolution, unlike a bundler),
// so it emits relative import/export specifiers byte-for-byte as written in
// source. This package's source — like every other @iris-ui/* package —
// writes them extensionless (idiomatic TS style under
// `moduleResolution: "Bundler"`). Bundlers (Vite, webpack, tsup's own
// bundling for react/vue/solid) resolve those leniently, but native Node ESM
// resolution requires an explicit extension on relative specifiers, so a
// real external `npm install` consumer's `import('@iris-ui/svelte')` fails
// with ERR_MODULE_NOT_FOUND (caught by scripts/check-pack-install.mjs at the
// repo root).
//
// This walks dist/**/*.js after the svelte-package build and appends the
// correct extension (`.js` or `/index.js`) to every relative import/export
// specifier that resolves to a file on disk. Specifiers that already carry
// an extension (`.svelte`, `.css`, `.json`, …) are left untouched.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

/**
 * Resolve the on-disk extension for a relative specifier, mirroring Node's
 * own resolution order for a directory-less then directory-index lookup.
 */
function resolveExtension(fromFile, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return specifier
  if (/\.[a-zA-Z0-9]+$/.test(specifier)) return specifier // already extensioned
  const base = join(dirname(fromFile), specifier)
  if (existsSync(base + '.js')) return specifier + '.js'
  if (existsSync(join(base, 'index.js'))) return specifier + '/index.js'
  return specifier // nothing found on disk; leave as-is rather than guess
}

/** Rewrite every relative import/export/dynamic-import specifier in `content`. */
function fixSpecifiers(file, content) {
  const replace = (match, quote, specifier) => {
    const resolved = resolveExtension(file, specifier)
    return resolved === specifier ? match : match.replace(quote + specifier + quote, quote + resolved + quote)
  }
  // import/export (type) (name | { ... }) from '...'
  content = content.replace(
    /\b(?:import|export)(?:\s+type)?(?:(?:\s+\p{L}[\p{L}0-9]*\s+)|(?:(?:\s+\p{L}[\p{L}0-9]*\s*,\s*)?\s*\{[^}]*\}\s*))from\s*(['"])([^'";]+)\1/gmu,
    replace,
  )
  // import/export (type) * as name from '...'
  content = content.replace(
    /\b(?:import|export)(?:\s+type)?\s*\*\s*as\s+\p{L}[\p{L}0-9]*\s+from\s*(['"])([^'";]+)\1/gmu,
    replace,
  )
  // export (type) * from '...'
  content = content.replace(/\b(?:export)(?:\s+type)?\s*\*\s*from\s*(['"])([^'";]+)\1/gmu, replace)
  // dynamic import('...')
  content = content.replace(/\bimport\s*\(\s*(['"])([^'";]+)\1\s*\)/g, replace)
  return content
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name.endsWith('.js')) {
      const original = readFileSync(path, 'utf8')
      const fixed = fixSpecifiers(path, original)
      if (fixed !== original) writeFileSync(path, fixed)
    }
  }
}

walk(distDir)
