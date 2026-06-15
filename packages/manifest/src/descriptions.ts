import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Harvest each component's prose description from the leading `/** … *\/` JSDoc
 * block directly above its exported `Iris<Name>` symbol in the React reference
 * source (the canonical implementation; the four adapters share semantics, so
 * one description covers them all). Plugin packages' React sub-entries are
 * scanned too. This turns the manifest's per-component `description` from an
 * empty field into real authored prose an agent can read — complementing the
 * already-harvested per-prop JSDoc.
 *
 * Deterministic and dependency-free (regex + text scan over source), matching
 * the rest of the manifest pipeline. Honest by design: a component with no
 * leading JSDoc simply gets no description — nothing is invented.
 */

export interface ComponentDoc {
  /** The JSDoc summary: the first prose paragraph, whitespace-collapsed. */
  description: string
  /** The `@example` body, if present (code fences/markers stripped). */
  example?: string
}

/** `export const/function/class Iris<Name>` — same surface the discovery uses. */
const EXPORT_RE = /export\s+(?:const|function|class)\s+(Iris[A-Za-z0-9]+)/g

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkTs(full, acc)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) acc.push(full)
  }
  return acc
}

/**
 * Strip the comment framing from a raw JSDoc block (the text between `/**` and
 * `*\/`) into clean lines: leading `*` markers removed, content preserved.
 */
function jsdocLines(block: string): string[] {
  return block.split('\n').map((line) => line.replace(/^\s*\*\s?/, '').replace(/\s+$/, ''))
}

/**
 * From a cleaned JSDoc block, build a {description, example?}.
 *  - description = the first prose paragraph (lines until the first blank line
 *    OR the first `@tag`), whitespace-collapsed to a single line;
 *  - example = the `@example` body (until the next `@tag` or end), with code
 *    fences (``` … ```) and a leading code-marker line removed, re-joined.
 */
function parseJsdoc(block: string): ComponentDoc | undefined {
  const lines = jsdocLines(block)

  // Summary: accumulate the first paragraph.
  const summary: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('@')) break // a tag ends the prose
    if (trimmed === '') {
      if (summary.length > 0) break // blank line ends the first paragraph
      continue // skip leading blanks
    }
    summary.push(trimmed)
  }
  const description = summary.join(' ').replace(/\s+/g, ' ').trim()
  if (!description) return undefined

  // Example: the body of the first `@example` tag, up to the next tag.
  let example: string | undefined
  const exampleStart = lines.findIndex((l) => l.trim().startsWith('@example'))
  if (exampleStart >= 0) {
    const first = lines[exampleStart].trim().replace(/^@example\s*/, '')
    const body: string[] = first ? [first] : []
    for (let i = exampleStart + 1; i < lines.length; i += 1) {
      if (lines[i].trim().startsWith('@')) break
      body.push(lines[i])
    }
    const cleaned = body
      .filter((l) => !/^\s*```/.test(l)) // drop fence markers
      .join('\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
    if (cleaned.trim()) example = cleaned
  }

  return example ? { description, example } : { description }
}

/** Scan one source root; record name → doc for `Iris<Name>` exports with leading JSDoc. */
function scanRoot(srcRoot: string, result: Map<string, ComponentDoc>): void {
  if (!existsSync(srcRoot)) return
  for (const file of walkTs(srcRoot)) {
    const text = readFileSync(file, 'utf8')
    EXPORT_RE.lastIndex = 0
    for (const match of text.matchAll(EXPORT_RE)) {
      const name = match[1]
      if (result.has(name)) continue // first declaration wins (matches props.ts)
      // Is the export immediately preceded by a JSDoc block? Walk back over
      // whitespace from the export to find a `*/` that closes a `/** … */`.
      const before = text.slice(0, match.index)
      if (!/\*\/\s*$/.test(before)) continue
      const close = before.lastIndexOf('*/')
      const open = before.lastIndexOf('/**', close)
      if (open < 0 || open >= close) continue
      // Reject if non-whitespace sits between the block and the export.
      if (before.slice(close + 2).trim() !== '') continue
      const block = before.slice(open + 3, close)
      const doc = parseJsdoc(block)
      if (doc) result.set(name, doc)
    }
  }
}

/**
 * Build name → {description, example?} from the React reference source plus each
 * plugin's React sub-entry. Mirrors the source roots `extractComponentProps`
 * uses, so descriptions and props are harvested from the same canonical files.
 */
export function extractComponentDocs(repoRoot: string): Map<string, ComponentDoc> {
  const result = new Map<string, ComponentDoc>()
  scanRoot(join(repoRoot, 'packages', 'react', 'src'), result)

  const packagesDir = join(repoRoot, 'packages')
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('plugin-')) continue
      scanRoot(join(packagesDir, entry.name, 'src', 'react'), result)
    }
  }
  return result
}
