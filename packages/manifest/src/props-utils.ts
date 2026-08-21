import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function aliasNestingDelta(ch: string): number {
  if (ch === '{' || ch === '[' || ch === '(') return 1
  if (ch === '}' || ch === ']' || ch === ')') return -1
  return 0
}

function startsFollowingDeclaration(text: string, index: number): boolean {
  const next = text.slice(index).trimStart()
  return (
    /^(?:(?:export|declare)\s+)?(?:interface|type|const|let|function|class|enum)\b/.test(next) ||
    next.startsWith('import ') ||
    next.startsWith('/**')
  )
}

/** Read a possibly multi-line type-alias RHS. */
export function typeAliasBody(text: string, start: number): string {
  let depth = 0
  let quote: "'" | '"' | '`' | undefined

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = undefined
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    depth += aliasNestingDelta(ch)
    if (ch === ';' && depth === 0) return text.slice(start, i).trim()
    if (ch === '\n' && depth === 0 && startsFollowingDeclaration(text, i + 1)) {
      return text.slice(start, i).trim()
    }
  }
  return text.slice(start).trim()
}

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkTs(full, acc)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) acc.push(full)
  }
  return acc
}

const TYPE_ALIAS_RE = /(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*=\s*([^;\n]+);?/g

/** Scan source roots for string-literal-union type aliases (name → raw RHS). */
export function extractTypeAliases(srcRoots: string[]): Map<string, string> {
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

/** Resolve a type expression to its complete string-literal union. */
export function resolveEnumValues(
  type: string,
  aliases: Map<string, string>,
  depth = 5,
): string[] | undefined {
  const t = type.trim()
  if (t === '') return undefined
  const parts = t.split('|').map((p) => p.trim())
  if (parts.every((p) => /^'[^']*'$/.test(p))) return parts.map((p) => p.slice(1, -1))
  if (depth > 0 && /^[A-Za-z0-9_]+$/.test(t) && aliases.has(t)) {
    return resolveEnumValues(aliases.get(t)!, aliases, depth - 1)
  }
  return undefined
}

/** Split a destructuring body on top-level commas, respecting comments and strings. */
export function splitTopLevel(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    const next = body[i + 1]
    if (ch === '/' && next === '*') {
      i = skipBlockComment(body, i)
      continue
    }
    if (ch === '/' && next === '/') {
      i = skipLineComment(body, i)
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuoted(body, i, ch)
      continue
    }
    const nextDepth = bracketDepth(ch, depth)
    if (nextDepth !== depth) depth = nextDepth
    else if (ch === ',' && depth === 0) {
      parts.push(body.slice(start, i))
      start = i + 1
    }
    i += 1
  }
  parts.push(body.slice(start))
  return parts
}

function bracketDepth(ch: string, depth: number): number {
  if (ch === '{' || ch === '[' || ch === '(') return depth + 1
  if (ch === '}' || ch === ']' || ch === ')') return depth - 1
  return depth
}

function skipBlockComment(body: string, i: number): number {
  const end = body.indexOf('*/', i + 2)
  return end < 0 ? body.length : end + 2
}

function skipLineComment(body: string, i: number): number {
  const end = body.indexOf('\n', i + 2)
  return end < 0 ? body.length : end
}

function skipQuoted(body: string, i: number, quote: string): number {
  let j = i + 1
  while (j < body.length) {
    if (body[j] === '\\') j += 2
    else if (body[j] === quote) return j + 1
    else j += 1
  }
  return j
}

/** A literal default (`'x'` / `"x"` / number / boolean). */
export function literalDefault(expr: string): string | undefined {
  const v = expr.trim()
  if (/^'[^']*'$/.test(v) || /^"[^"]*"$/.test(v)) return v.slice(1, -1)
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return v
  if (v === 'true' || v === 'false') return v
  return undefined
}

/** Parse literal defaults from a component's destructured first parameter. */
export function extractDefaults(text: string, componentName: string): Map<string, string> {
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
