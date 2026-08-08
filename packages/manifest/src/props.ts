import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Framework, ManifestProp } from './schema'

/**
 * Extract each component's typed prop contract from its `Iris<Name>Props`
 * interface in the React adapter source (the most complete adapter, with
 * explicit interfaces). This turns the manifest from a list of NAMES into typed
 * contracts an agent can call without guessing — the core of the AI-native
 * value. Deterministic and dependency-free (regex over source text), matching
 * the rest of the manifest pipeline.
 *
 * Best-effort by design: it captures the EXPLICIT props in an interface or
 * object-bearing type alias (the ones a caller actually sets); inherited native
 * props via `extends Omit<HTMLAttributes…>` are intentionally not expanded.
 * A public alias such as `type IrisXProps = HTMLAttributes<…>` is still a real
 * native contract, with an empty explicit-prop list rather than "unavailable".
 */

/** Match `export interface Iris<Name>Props<...> ... {` capturing the base name. */
const PROPS_INTERFACE_RE = /export\s+interface\s+(Iris[A-Za-z0-9]+)Props\b[^{]*\{/g
const PROPS_TYPE_ALIAS_RE = /export\s+type\s+(Iris[A-Za-z0-9]+)Props\b[^=]*=/g
const NAMED_PROPS_INTERFACE_RE = /(?:export\s+)?interface\s+(Iris[A-Za-z0-9]+Props)\b[^{]*\{/g

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
export function interfaceBody(text: string, openBraceIndex: number): string {
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

/** Accumulate a multi-line block-comment line into the pending doc string. */
function accumulateDoc(line: string, pendingDoc: string | undefined): string | undefined {
  const cleaned = line.replace(/^\*\s?/, '').trim()
  if (!cleaned) return pendingDoc
  return pendingDoc ? pendingDoc + ' ' + cleaned : cleaned
}

/** Try to match a single-line JSDoc or start a multi-line block comment. */
function consumeDocComment(line: string): {
  doc: string | undefined
  inBlock: boolean
} {
  const oneLine = line.match(/^\/\*\*\s*(.*?)\s*\*\/$/)
  if (oneLine) return { doc: oneLine[1] || undefined, inBlock: false }
  return { doc: undefined, inBlock: true }
}

/** Parse an interface body into props, attaching preceding JSDoc summaries. */
export function parsePropsBody(body: string): ManifestProp[] {
  const props: ManifestProp[] = []
  const lines = body.split('\n')
  let pendingDoc: string | undefined
  let inBlockComment = false
  let depth = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false
      else pendingDoc = accumulateDoc(line, pendingDoc)
      continue
    }
    if (line.startsWith('/**')) {
      const result = consumeDocComment(line)
      if (result.doc !== undefined) pendingDoc = result.doc
      else {
        inBlockComment = true
        pendingDoc = undefined
      }
      continue
    }
    if (line.startsWith('//') || line === '') continue

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

/**
 * Read a possibly multi-line type-alias RHS. TypeScript permits aliases without
 * semicolons, so a following declaration at top level is also a terminator.
 */
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

function typeAliasBody(text: string, start: number): string {
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
    if (ch === ';' && depth === 0) {
      return text.slice(start, i).trim()
    }
    if (ch === '\n' && depth === 0 && startsFollowingDeclaration(text, i + 1)) {
      return text.slice(start, i).trim()
    }
  }
  return text.slice(start).trim()
}

/** Every local Iris*Props interface, including helper union branches. */
function namedPropsInterfaces(text: string): Map<string, ManifestProp[]> {
  const result = new Map<string, ManifestProp[]>()
  for (const match of text.matchAll(NAMED_PROPS_INTERFACE_RE)) {
    const open = match.index! + match[0].length - 1
    result.set(match[1], parsePropsBody(interfaceBody(text, open)))
  }
  return result
}

function mergeProp(target: Map<string, ManifestProp>, prop: ManifestProp): void {
  const current = target.get(prop.name)
  if (!current) {
    target.set(prop.name, { ...prop })
    return
  }
  current.optional ||= prop.optional
  if (current.type !== prop.type) {
    const unionMember = (type: string): string => (type.includes('=>') ? `(${type})` : type)
    current.type = `${unionMember(current.type)} | ${unionMember(prop.type)}`
  }
  if (!current.description && prop.description) current.description = prop.description
}

/**
 * Extract explicit fields from an alias. This covers both inline intersections
 * and discriminated-union branches such as IrisToggleGroupProps, while aliases
 * that merely expose native framework attributes correctly yield zero explicit
 * fields.
 */
function propsFromTypeAlias(
  alias: string,
  localInterfaces: Map<string, ManifestProp[]>,
): ManifestProp[] {
  const merged = new Map<string, ManifestProp>()
  for (const match of alias.matchAll(/\b(Iris[A-Za-z0-9]+Props)\b/g)) {
    for (const prop of localInterfaces.get(match[1]) ?? []) mergeProp(merged, prop)
  }
  for (let i = 0; i < alias.length; i += 1) {
    if (alias[i] !== '{') continue
    const body = interfaceBody(alias, i)
    if (!body) continue
    for (const prop of parsePropsBody(body)) mergeProp(merged, prop)
    i += body.length + 1
  }
  return [...merged.values()]
}

/** Match `(export) type X = <rhs>` — captures the alias name + its RHS,
 * terminated by a `;` OR end-of-line (TS allows omitting the semicolon). */
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

/**
 * Resolve a type expression to its string-literal members, following type
 * aliases (e.g. `IrisButtonVariant` → `Variant` → `'solid' | 'outline' | …`).
 * Returns the values only when EVERY union member is a string literal;
 * otherwise undefined (a partial/non-enumerable type isn't enumerated).
 */
export function resolveEnumValues(
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

/**
 * Split a destructuring body on top-level commas (respecting `{}`/`[]`/`()`
 * nesting). Block/line comments are skipped entirely — a JSDoc above a prop
 * may contain commas or braces (e.g. `(1, 5, 10, 15, 30)`) that must not be
 * treated as entry separators, and string literals are respected so a comma
 * inside a default value stays put. A trailing comma yields a final empty
 * entry (callers skip it via their per-entry parsing).
 */
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

/** Return the updated nesting depth for a `{}`/`[]`/`()` character. */
function bracketDepth(ch: string, depth: number): number {
  if (ch === '{' || ch === '[' || ch === '(') return depth + 1
  if (ch === '}' || ch === ']' || ch === ')') return depth - 1
  return depth
}

/** Advance past a `/* … *\/` comment (or to end of body when unterminated). */
function skipBlockComment(body: string, i: number): number {
  const end = body.indexOf('*/', i + 2)
  return end < 0 ? body.length : end + 2
}

/** Advance past a `// …` comment. */
function skipLineComment(body: string, i: number): number {
  const end = body.indexOf('\n', i + 2)
  return end < 0 ? body.length : end
}

/** Advance past a quoted string literal (respecting backslash escapes). */
function skipQuoted(body: string, i: number, quote: string): number {
  let j = i + 1
  while (j < body.length) {
    if (body[j] === '\\') j += 2
    else if (body[j] === quote) return j + 1
    else j += 1
  }
  return j
}

/** A literal default (`'x'` / `"x"` / number / boolean) → its serialized form, else undefined. */
export function literalDefault(expr: string): string | undefined {
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

const SLOT_TYPE_RE = /ReactNode|ReactElement|JSX\.Element|VNode|Snippet/

/**
 * Classify a list of props into event-handler names and slot names.
 * Events: props matching `/^on[A-Z]/`. Slots: props whose type contains a
 * renderable type pattern, with `children` normalised to `'default'`.
 */
export function classifyProps(props: ManifestProp[]): {
  events: string[]
  slots: string[]
} {
  const events = props.filter((p) => /^on[A-Za-z]/.test(p.name)).map((p) => p.name)
  const slots = props
    .filter((p) => SLOT_TYPE_RE.test(p.type))
    .map((p) => (p.name === 'children' ? 'default' : p.name))
    .filter((name, idx, arr) => arr.indexOf(name) === idx)
  return { events, slots }
}

/** Scan a single source root and add discovered props into `result`. */
function scanSrcRoot(
  srcRoot: string,
  result: Map<string, ManifestProp[]>,
  aliases: Map<string, string>,
): void {
  if (!existsSync(srcRoot)) return
  for (const file of walkTs(srcRoot)) {
    const text = readFileSync(file, 'utf8')
    const localInterfaces = namedPropsInterfaces(text)
    for (const match of text.matchAll(PROPS_INTERFACE_RE)) {
      const name = match[1]
      if (result.has(name)) continue // first declaration wins
      const open = match.index! + match[0].length - 1 // index of the `{`
      const body = interfaceBody(text, open)
      const props = parsePropsBody(body)
      const defaults = extractDefaults(text, name)
      for (const prop of props) {
        const values = resolveEnumValues(prop.type, aliases)
        if (values && values.length > 0) prop.enum = values
        const def = defaults.get(prop.name)
        if (def !== undefined) prop.default = def
      }
      result.set(name, props)
    }
    for (const match of text.matchAll(PROPS_TYPE_ALIAS_RE)) {
      const name = match[1]
      if (result.has(name)) continue
      const props = propsFromTypeAlias(
        typeAliasBody(text, match.index! + match[0].length),
        localInterfaces,
      )
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
}

/**
 * Extract explicit `Iris<Name>Props` interfaces/type aliases from one TS/TSX
 * adapter and that adapter's plugin sub-entries. Vue and Svelte components are
 * additionally handled by their native-source extractors in `contracts.ts`.
 */
export function extractInterfaceComponentProps(
  repoRoot: string,
  framework: Extract<Framework, 'react' | 'solid' | 'svelte'>,
): Map<string, ManifestProp[]> {
  const result = new Map<string, ManifestProp[]>()
  const srcRoot = join(repoRoot, 'packages', framework, 'src')
  if (!existsSync(srcRoot)) return result

  // Type aliases come from the React adapter, framework-agnostic core, and each
  // plugin's React sub-entry (so plugin prop types resolve correctly).
  const pluginsDir = join(repoRoot, 'packages')
  const pluginRoots: string[] = existsSync(pluginsDir)
    ? readdirSync(pluginsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith('plugin-'))
        .map((e) => join(pluginsDir, e.name, 'src', framework))
        .filter(existsSync)
    : []

  const aliases = extractTypeAliases([
    srcRoot,
    join(repoRoot, 'packages', 'core', 'src'),
    ...pluginRoots,
  ])

  // Core React adapter — primary source for all core component props.
  scanSrcRoot(srcRoot, result, aliases)

  // Plugin packages — each plugin's React sub-entry carries its own Props
  // interfaces (e.g. `IrisCodeEditorProps`, `IrisFormBuilderProps`).
  for (const pluginRoot of pluginRoots) {
    scanSrcRoot(pluginRoot, result, aliases)
  }

  return result
}

/** Backward-compatible React reference extraction used by schema-v1 fields. */
export function extractComponentProps(repoRoot: string): Map<string, ManifestProp[]> {
  return extractInterfaceComponentProps(repoRoot, 'react')
}
