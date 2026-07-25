#!/usr/bin/env node

/**
 * checks/spelling.mjs — Spell check source files using cspell.
 *
 * Runs cspell (if available) or a simple word-based spell check on source files.
 * Reports misspelled words and suggests corrections.
 *
 * Usage: node cli.mjs check-spelling [--dir packages/core/src]
 */

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

// Common technical terms to allow (not misspellings)
const ALLOW_LIST = new Set([
  'Iris', 'api', 'APIs', 'async', 'await', 'boolean', 'bool', 'btn',
  'callback', 'cli', 'CMS', 'cms', 'color', 'composables', 'const',
  'css', 'CSV', 'csv', 'ctx', 'cyclomatic', 'deps', 'destruct', 'destructuring',
  'dev', 'dialog', 'dropdown', 'enum', 'esm', 'extensibility', 'favicon',
  'flexbox', 'form', 'gzip', 'href', 'html', 'http', 'https', 'i18n',
  'iframe', 'inline', 'input', 'json', 'jsx', 'keyframe', 'keyframes',
  'keyof', 'lifecycle', 'locale', 'localhost', 'lorem', 'minify',
  'mkdir', 'monorepo', 'msg', 'namespace', 'nav', 'nullish', 'npm',
  'num', 'onboarding', 'params', 'pkg', 'playwright', 'pnpm', 'popover',
  'prefs', 'primitives', 'prop', 'props', 'react', 'refactor', 'refs',
  'renderless', 'resizer', 'revalidate', 'roving', 'rsc', 'scrim',
  'scrollable', 'serializable', 'serialize', 'serif', 'server', 'skinned',
  'slider', 'slug', 'solidjs', 'spreadsheet', 'ssr', 'stdin', 'stdout',
  'stringify', 'str', 'submenu', 'svelte', 'svg', 'swipeable', 'tabindex',
  'tbody', 'thead', 'tfoot', 'textarea', 'todos', 'toolbar', 'tooltip',
  'turborepo', 'turbo', 'typescript', 'typeof', 'ui', 'unmount', 'url',
  'utils', 'validator', 'vite', 'vitest', 'vue', 'vxe', 'wcag', 'xml',
  'yaml', 'yarn', 'zlib',
])

// Known misspellings and their corrections
const COMMON_TYPOS = {
  'teh': 'the', 'recieve': 'receive', 'acheive': 'achieve',
  'definately': 'definitely', 'seperate': 'separate', 'occured': 'occurred',
  'occuring': 'occurring', 'alot': 'a lot', 'cant': 'cannot',
  'dont': "don't", 'doesnt': "doesn't", 'isnt': "isn't",
  'wasnt': "wasn't", 'wouldnt': "wouldn't", 'couldnt': "couldn't",
  'shouldnt': "shouldn't", 'wont': "won't", 'compoment': 'component',
}

function walkDir(dir) {
  const files = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...walkDir(full))
      } else if (/\.(ts|tsx|vue|svelte)$/.test(entry.name)) {
        files.push(full)
      }
    }
  } catch { /* skip */ }
  return files
}

export async function run(opts = {}) {
  const args = process.argv.slice(3)
  const targetDir = args.find(a => !a.startsWith('--')) || 'packages/core/src'
  const targetPath = resolve(ROOT, targetDir)

  console.log(`--- Spell Check: ${targetDir} ---\n`)

  // Try cspell first (if installed), fall back to simple check
  let useCspell = false
  try {
    execSync('npx cspell --version', { stdio: 'pipe', timeout: 5000 })
    useCspell = true
  } catch { /* cspell not available */ }

  if (useCspell) {
    try {
      execSync(`npx cspell --no-summary "${targetPath}/**/*.{ts,tsx,vue,svelte}"`, {
        cwd: ROOT, stdio: 'inherit', timeout: 30000,
      })
      console.log('\n  ✓ No spelling issues found.\n')
      return 0
    } catch {
      console.log('\n  ❌ Spelling issues found.\n')
      return 1
    }
  }

  // Fallback: simple word-level check
  console.log('  (cspell not available, using fallback checker)\n')

  const files = walkDir(targetPath)
  let errors = 0
  let totalWords = 0
  const foundIssues = []

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    // Skip comments and strings
    const sanitized = content
      .replace(/\/\/.*$/gm, '')    // single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
      .replace(/['"`][^'"`]*['"`]/g, '') // strings

    const words = sanitized.match(/\b[a-zA-Z]{4,}\b/g) || []
    totalWords += words.length

    for (const word of words) {
      if (ALLOW_LIST.has(word)) continue
      if (COMMON_TYPOS[word.toLowerCase()]) {
        errors++
        foundIssues.push({
          file: relative(ROOT, file),
          word,
          suggestion: COMMON_TYPOS[word.toLowerCase()],
        })
      }
    }
  }

  if (errors === 0) {
    console.log(`  ✓ ${totalWords} words checked, no issues.\n`)
    return 0
  }

  for (const issue of foundIssues.slice(0, 30)) {
    console.log(`  ✗ "${issue.word}" → "${issue.suggestion}" in ${issue.file}`)
  }

  if (foundIssues.length > 30) {
    console.log(`  ... and ${foundIssues.length - 30} more`)
  }

  console.log(`\n  ${errors} spelling issue(s) found in ${totalWords} words.\n`)
  return 1
}