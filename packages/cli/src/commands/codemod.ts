import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CODEMODS, findCodemod } from '../codemods/registry.js'

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.turbo'])

/**
 * Recursively collect every file under `dir` (skipping node_modules/dist/.git/.turbo).
 */
function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      walkFiles(join(dir, entry.name), out)
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

/**
 * Resolve a target argument to a concrete list of file paths. Supports:
 *   - a single file path
 *   - a directory (walked recursively)
 *   - a simple "<dir>/**\/*.ext" or "<dir>/*.ext" pattern — only the trailing
 *     "*.ext" segment is treated specially; everything before the first "*"
 *     is used as the base directory to walk and filter by extension.
 *
 * This is intentionally NOT a full glob implementation (no brace expansion,
 * no character classes, no mid-path wildcards) — see packages/cli/README.md.
 */
export function resolveTargets(pattern: string): string[] {
  if (!pattern.includes('*')) {
    if (!existsSync(pattern)) return []
    return statSync(pattern).isDirectory() ? walkFiles(pattern) : [pattern]
  }

  const starIndex = pattern.indexOf('*')
  const prefix = pattern.slice(0, starIndex)
  const baseDir = prefix === '' ? '.' : dirname(prefix.endsWith('/') ? prefix + 'x' : prefix)
  const extMatch = pattern.match(/\*\.([A-Za-z0-9]+)$/)
  const ext = extMatch ? `.${extMatch[1]}` : undefined

  if (!existsSync(baseDir) || !statSync(baseDir).isDirectory()) return []
  const all = walkFiles(baseDir)
  return ext ? all.filter((f) => f.endsWith(ext)) : all
}

/**
 * Simple line-by-line before/after preview (not a real unified diff — see
 * packages/cli/README.md for why we don't pull in a diff library).
 */
function diffPreview(before: string, after: string): string {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const max = Math.max(beforeLines.length, afterLines.length)
  const lines: string[] = []
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i]
    const a = afterLines[i]
    if (b === a) continue
    if (b !== undefined) lines.push(`    - ${b}`)
    if (a !== undefined) lines.push(`    + ${a}`)
  }
  return lines.join('\n') + (lines.length > 0 ? '\n' : '')
}

/**
 * Print each registered codemod as a single line: name + description.
 * Returns the exit code (always 0).
 */
export function runCodemodList(): number {
  for (const c of CODEMODS) {
    process.stdout.write(`${c.name.padEnd(28)}${c.description}\n`)
  }
  return 0
}

export interface RunCodemodOptions {
  dryRun?: boolean
}

/**
 * Apply codemod `name` to every file matched by `target`, writing back only
 * files whose content actually changed (unless `dryRun` is set, in which
 * case nothing is written and a before/after preview is printed instead).
 * Returns the exit code (0 = ok, 1 = unknown codemod or no matching files).
 */
export function runCodemodRun(
  name: string,
  target: string,
  options: RunCodemodOptions = {},
): number {
  const codemod = findCodemod(name)
  if (!codemod) {
    process.stderr.write(
      `Error: unknown codemod "${name}". Run "iris-ui codemod list" to see available codemods.\n`,
    )
    return 1
  }

  const files = resolveTargets(target)
  if (files.length === 0) {
    process.stderr.write(`Error: no files matched "${target}".\n`)
    return 1
  }

  let changedCount = 0
  for (const file of files) {
    const original = readFileSync(file, 'utf8')
    const next = codemod.transform(original, file)

    if (next === original) {
      process.stdout.write(`  unchanged      ${file}\n`)
      continue
    }

    changedCount++
    if (options.dryRun) {
      process.stdout.write(`  would change   ${file}\n`)
      process.stdout.write(diffPreview(original, next))
    } else {
      writeFileSync(file, next, 'utf8')
      process.stdout.write(`  changed        ${file}\n`)
    }
  }

  const verb = options.dryRun ? 'would change' : 'changed'
  process.stdout.write(`\n${changedCount} of ${files.length} file(s) ${verb}.\n`)
  return 0
}
