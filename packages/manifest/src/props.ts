import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Framework, ManifestProp } from './schema'
import {
  extractDefaults,
  extractTypeAliases,
  resolveEnumValues,
  typeAliasBody,
} from './props-utils'

export {
  extractTypeAliases,
  literalDefault,
  resolveEnumValues,
  splitTopLevel,
  typeAliasBody,
} from './props-utils'

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
const PROPS_INTERFACE_RE = /export\s+interface\s+(Iris[A-Za-z0-9]+)Props\b([^{}]*)\{/g
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

    // Track all TypeScript delimiters so multi-line callback/tuple/object
    // types don't leak their parameter names into the parent contract.
    for (const ch of line) {
      if ('{[('.includes(ch)) depth += 1
      else if ('}])'.includes(ch)) depth = Math.max(0, depth - 1)
    }
  }
  return props
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

interface PropsInterfaceDefinition {
  props: ManifestProp[]
  extendsNames: string[]
}

/** Collect custom `Iris*Props` interfaces so public wrapper interfaces can
 * inherit their explicit fields across the split source files. Native DOM
 * bases (React.HTMLAttributes, JSX.HTMLAttributes, etc.) are intentionally
 * ignored; only Iris-owned contracts belong in the machine-readable manifest.
 */
function propsInterfaceDefinitions(files: string[]): Map<string, PropsInterfaceDefinition> {
  const definitions = new Map<string, PropsInterfaceDefinition>()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(PROPS_INTERFACE_RE)) {
      const name = `${match[1]}Props`
      const open = match.index! + match[0].length - 1
      const heritage = match[2] ?? ''
      if (!definitions.has(name)) {
        definitions.set(name, {
          props: parsePropsBody(interfaceBody(text, open)),
          extendsNames: [...heritage.matchAll(/\b(Iris[A-Za-z0-9]+Props)\b/g)].map((m) => m[1]),
        })
      }
    }
  }
  return definitions
}

function resolveInterfaceProps(
  name: string,
  definitions: Map<string, PropsInterfaceDefinition>,
  visiting = new Set<string>(),
): ManifestProp[] {
  const definition = definitions.get(name)
  if (!definition || visiting.has(name)) return []
  const nextVisiting = new Set(visiting).add(name)
  const merged = new Map<string, ManifestProp>()
  for (const prop of definition.props) mergeProp(merged, prop)
  for (const base of definition.extendsNames) {
    for (const prop of resolveInterfaceProps(base, definitions, nextVisiting)) {
      mergeProp(merged, prop)
    }
  }
  return [...merged.values()]
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

/**
 * Parse `name = literal` defaults from a component's destructured first
 * parameter — covers both `export function IrisX({ … })` and
 * `forwardRef(function IrisX({ … }, ref))`. Only literal defaults are captured.
 */
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
  const files = walkTs(srcRoot)
  const interfaceDefinitions = propsInterfaceDefinitions(files)
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const localInterfaces = namedPropsInterfaces(text)
    for (const match of text.matchAll(PROPS_INTERFACE_RE)) {
      const name = match[1]
      if (result.has(name)) continue // first declaration wins
      const props = resolveInterfaceProps(`${name}Props`, interfaceDefinitions)
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
