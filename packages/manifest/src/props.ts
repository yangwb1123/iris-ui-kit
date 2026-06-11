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

/** Match `(export) type X = <rhs>` — captures the alias name + its RHS,
 * terminated by a `;` OR end-of-line (TS allows omitting the semicolon). */
const TYPE_ALIAS_RE = /(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*=\s*([^;\n]+);?/g

/** Scan source roots for string-literal-union type aliases (name → raw RHS). */
function extractTypeAliases(srcRoots: string[]): Map<string, string> {
  const aliases = new Map<string, string>()
  for (const root of srcRoots) {
    if (!existsSync(root)) continue
    for (const file of walkTs(root)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(TYPE_ALIAS_RE)) {
        const name = m[1]
        if (!aliases.has(name)) aliases.set(name, m[2].replace(/\s+/g, ' ').trim())
      }
    }
  }
  return aliases
}

/**
 * Resolve a type expression to its string-literal members, following type
 * aliases (e.g. `IrisButtonVariant` → `Variant` → `'solid' | 'outline' | …`).
 * Returns the values only when EVERY union member is a string literal;
 * otherwise undefined (a partial/non-enumerable type isn't enumerated).
 */
function resolveEnumValues(
  type: string,
  aliases: Map<string, string>,
  depth = 5,
): string[] | undefined {
  const t = type.trim()
  if (t === '') return undefined

  // A union (or single) of string literals: split on top-level `|`.
  const parts = t.split('|').map((p) => p.trim())
  if (parts.every((p) => /^'[^']*'$/.test(p))) {
    return parts.map((p) => p.slice(1, -1))
  }

  // A bare identifier that's a known alias → resolve its RHS.
  if (depth > 0 && /^[A-Za-z0-9_]+$/.test(t) && aliases.has(t)) {
    return resolveEnumValues(aliases.get(t)!, aliases, depth - 1)
  }
  return undefined
}

/** Split a destructuring body on top-level commas (respecting `{}`/`[]`/`()` nesting). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (ch === '{' || ch === '[' || ch === '(') depth += 1
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1
    else if (ch === ',' && depth === 0) {
      parts.push(body.slice(start, i))
      start = i + 1
    }
  }
  parts.push(body.slice(start))
  return parts
}

/** A literal default (`'x'` / `"x"` / number / boolean) → its serialized form, else undefined. */
function literalDefault(expr: string): string | undefined {
  const v = expr.trim()
  if (/^'[^']*'$/.test(v) || /^"[^"]*"$/.test(v)) return v.slice(1, -1)
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return v
  if (v === 'true' || v === 'false') return v
  return undefined
}

/**
 * Parse `name = literal` defaults from a component's destructured first
 * parameter — covers both `export function IrisX({ … })` and
 * `forwardRef(function IrisX({ … }, ref))`. Only literal defaults are captured.
 */
function extractDefaults(text: string, componentName: string): Map<string, string> {
  const defaults = new Map<string, string>()
  const fn = new RegExp(`function\\s+${componentName}\\b`).exec(text)
  if (!fn) return defaults
  const paren = text.indexOf('(', fn.index)
  const open = paren < 0 ? -1 : text.indexOf('{', paren)
  if (open < 0) return defaults
  let depth = 0
  let end = -1
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return defaults
  for (const part of splitTopLevel(text.slice(open + 1, end))) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    if (!/^[A-Za-z_]\w*$/.test(name)) continue
    const def = literalDefault(part.slice(eq + 1))
    if (def !== undefined) defaults.set(name, def)
  }
  return defaults
}

export function extractComponentProps(repoRoot: string): Map<string, ManifestProp[]> {
  const result = new Map<string, ManifestProp[]>()
  const srcRoot = join(repoRoot, 'packages', 'react', 'src')
  if (!existsSync(srcRoot)) return result

  // Type aliases come from both the React adapter and the framework-agnostic
  // core (where shared unions like `Variant`/`Size`/`Placement` live).
  const aliases = extractTypeAliases([srcRoot, join(repoRoot, 'packages', 'core', 'src')])

  for (const file of walkTs(srcRoot)) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(PROPS_INTERFACE_RE)) {
      const name = match[1]
      if (result.has(name)) continue // first declaration wins
      const open = match.index! + match[0].length - 1 // index of the `{`
      const body = interfaceBody(text, open)
      const props = parseBody(body)
      if (props.length === 0) continue
      const defaults = extractDefaults(text, name)
      for (const prop of props) {
        const values = resolveEnumValues(prop.type, aliases)
        if (values && values.length > 0) prop.enum = values
        const def = defaults.get(prop.name)
        if (def !== undefined) prop.default = def
      }
      result.set(name, props)
    }
  }
  return result
}
