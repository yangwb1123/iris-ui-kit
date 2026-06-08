import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ManifestProp } from './schema'

/**
 * Extract each component's typed prop contract from its `Iris<Name>Props`
 * interface in the React adapter source (the most complete adapter, with
 * explicit interfaces). This turns the manifest from a list of NAMES into typed
 * contracts an agent can call without guessing — the core of the AI-native
 * value. Deterministic and dependency-free (regex over source text), matching
 * the rest of the manifest pipeline.
 *
 * Best-effort by design: it captures the EXPLICIT props in the interface body
 * (the ones a caller actually sets); inherited native props via `extends
 * Omit<HTMLAttributes…>` are intentionally not expanded. Components whose
 * interface isn't found simply get no props.
 */

/** Match `export interface Iris<Name>Props<...> ... {` capturing the base name. */
const PROPS_INTERFACE_RE = /export\s+interface\s+(Iris[A-Za-z0-9]+)Props\b[^{]*\{/g

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkTs(full, acc)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) acc.push(full)
  }
  return acc
}

/** From the index of the interface's opening `{`, return the body (brace-matched). */
function interfaceBody(text: string, openBraceIndex: number): string {
  let depth = 0
  for (let i = openBraceIndex; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return text.slice(openBraceIndex + 1, i)
    }
  }
  return ''
}

/** A top-level member: `name?: type` (methods / index signatures excluded). */
const MEMBER_RE = /^(?:readonly\s+)?([A-Za-z_]\w*)(\?)?\s*:\s*(.+?)\s*;?$/

/** Parse an interface body into props, attaching preceding JSDoc summaries. */
function parseBody(body: string): ManifestProp[] {
  const props: ManifestProp[] = []
  const lines = body.split('\n')
  let pendingDoc: string | undefined
  let inBlockComment = false
  let depth = 0 // brace depth WITHIN the body, so nested object types are skipped

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // JSDoc / block comment accumulation.
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false
      else {
        const cleaned = line.replace(/^\*\s?/, '').trim()
        if (cleaned) pendingDoc = pendingDoc ? `${pendingDoc} ${cleaned}` : cleaned
      }
      continue
    }
    if (line.startsWith('/**')) {
      const oneLine = line.match(/^\/\*\*\s*(.*?)\s*\*\/$/)
      if (oneLine) pendingDoc = oneLine[1] || undefined
      else {
        inBlockComment = true
        pendingDoc = undefined
      }
      continue
    }
    if (line.startsWith('//') || line === '') continue

    // Only parse members at the body's top level (skip nested object-type lines).
    // The regex requires `name?:` directly, so method signatures (`foo(): T`)
    // and index signatures (`[key: string]: T`) are naturally excluded.
    if (depth === 0) {
      const m = MEMBER_RE.exec(line)
      if (m) {
        const [, name, optional, type] = m
        props.push({
          name,
          type: type.replace(/,$/, '').trim(),
          optional: optional === '?',
          ...(pendingDoc ? { description: pendingDoc } : {}),
        })
      }
      pendingDoc = undefined
    }

    // Track brace depth so a multi-line nested object type doesn't yield members.
    for (const ch of line) {
      if (ch === '{') depth += 1
      else if (ch === '}') depth = Math.max(0, depth - 1)
    }
  }
  return props
}

export function extractComponentProps(repoRoot: string): Map<string, ManifestProp[]> {
  const result = new Map<string, ManifestProp[]>()
  const srcRoot = join(repoRoot, 'packages', 'react', 'src')
  if (!existsSync(srcRoot)) return result

  for (const file of walkTs(srcRoot)) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(PROPS_INTERFACE_RE)) {
      const name = match[1]
      if (result.has(name)) continue // first declaration wins
      const open = match.index! + match[0].length - 1 // index of the `{`
      const body = interfaceBody(text, open)
      const props = parseBody(body)
      if (props.length > 0) result.set(name, props)
    }
  }
  return result
}
