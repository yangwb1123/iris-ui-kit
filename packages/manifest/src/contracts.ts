import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import type { Framework, ManifestFrameworkContract, ManifestProp } from './schema'
import { ALL_FRAMEWORKS } from './schema'
import {
  classifyProps,
  extractInterfaceComponentProps,
  extractTypeAliases,
  interfaceBody,
  literalDefault,
  parsePropsBody,
  resolveEnumValues,
  splitTopLevel,
} from './props'

type ContractMap = Map<string, Partial<Record<Framework, ManifestFrameworkContract>>>

function walk(root: string, accept: RegExp, acc: string[] = []): string[] {
  if (!existsSync(root)) return acc
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(root, entry.name)
    if (entry.isDirectory()) walk(full, accept, acc)
    else if (accept.test(entry.name) && !entry.name.includes('.test.')) acc.push(full)
  }
  return acc
}

function adapterRoots(repoRoot: string, framework: Framework): string[] {
  const packages = join(repoRoot, 'packages')
  const roots = [join(packages, framework, 'src')]
  if (!existsSync(packages)) return roots
  for (const entry of readdirSync(packages, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('plugin-')) continue
    const root = join(packages, entry.name, 'src', framework)
    if (existsSync(root)) roots.push(root)
  }
  return roots
}

function addContract(
  result: ContractMap,
  name: string,
  framework: Framework,
  contract: ManifestFrameworkContract,
): void {
  const current = result.get(name) ?? {}
  current[framework] = contract
  result.set(name, current)
}

/** Public Iris-prefixed types explicitly re-exported by adapter/plugin barrels. */
function publicTypes(roots: string[]): Set<string> {
  const found = new Set<string>()
  for (const root of roots) {
    for (const file of walk(root, /^index\.tsx?$/)) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/export\s+type\s*\{([\s\S]*?)\}/g)) {
        for (const name of match[1].matchAll(/\b(Iris[A-Za-z0-9]+)\b/g)) found.add(name[1])
      }
      for (const match of text.matchAll(/export\s*\{([\s\S]*?)\}/g)) {
        for (const name of match[1].matchAll(/\btype\s+(Iris[A-Za-z0-9]+)\b/g)) {
          found.add(name[1])
        }
      }
    }
  }
  return found
}

function typesFor(componentName: string, exported: Set<string>): string[] {
  return [...exported].filter((name) => name.startsWith(componentName)).sort()
}

function mergeUnique(...lists: string[][]): string[] {
  return [...new Set(lists.flat())].sort()
}

function enrichProps(
  props: ManifestProp[],
  aliases: Map<string, string>,
  defaults: Map<string, string> = new Map(),
): ManifestProp[] {
  for (const prop of props) {
    const values = resolveEnumValues(prop.type, aliases)
    if (values?.length) prop.enum = values
    const value = defaults.get(prop.name)
    if (value !== undefined) prop.default = value
  }
  return props
}

function nativeContract(
  props: ManifestProp[],
  exported: Set<string>,
  name: string,
  extraEvents: string[] = [],
  extraSlots: string[] = [],
): ManifestFrameworkContract {
  const classified = classifyProps(props)
  return {
    source: 'native',
    props,
    events: mergeUnique(classified.events, extraEvents),
    slots: mergeUnique(classified.slots, extraSlots),
    publicTypes: typesFor(name, exported),
  }
}

function extractInterfaceContracts(repoRoot: string, result: ContractMap): void {
  for (const framework of ['react', 'solid'] as const) {
    const exported = publicTypes(adapterRoots(repoRoot, framework))
    for (const [name, props] of extractInterfaceComponentProps(repoRoot, framework)) {
      addContract(result, name, framework, nativeContract(props, exported, name))
    }
  }
}

function balancedTypeArgument(text: string, marker: string): string | undefined {
  const index = text.indexOf(marker)
  if (index < 0) return undefined
  const start = index + marker.length
  let depth = 1
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '<') depth += 1
    else if (text[i] === '>') {
      depth -= 1
      if (depth === 0) return text.slice(start, i).replace(/\s+/g, ' ').trim()
    }
  }
  return undefined
}

function vueRuntimeType(value: string): string {
  const typed = balancedTypeArgument(value, 'PropType<')
  if (typed) return typed
  const constructors = [
    ...value.matchAll(/\b(String|Number|Boolean|Array|Object|Function)\b/g),
  ].map(
    (match) =>
      ({
        String: 'string',
        Number: 'number',
        Boolean: 'boolean',
        Array: 'unknown[]',
        Object: 'Record<string, unknown>',
        Function: '(...args: unknown[]) => unknown',
      })[match[1]]!,
  )
  return mergeUnique(constructors).join(' | ') || 'unknown'
}

function withoutLeadingComments(value: string): string {
  let result = value.trim()
  while (result.startsWith('/**') || result.startsWith('//')) {
    if (result.startsWith('/**')) {
      const end = result.indexOf('*/')
      if (end < 0) break
      result = result.slice(end + 2).trim()
    } else {
      const end = result.indexOf('\n')
      if (end < 0) return ''
      result = result.slice(end + 1).trim()
    }
  }
  return result
}

function objectPropertyBody(body: string, property: string): string {
  const match = new RegExp(`\\b${property}\\s*:\\s*\\{`).exec(body)
  if (!match) return ''
  return interfaceBody(body, match.index + match[0].length - 1)
}

function parseVueProps(body: string, aliases: Map<string, string>): ManifestProp[] {
  const props: ManifestProp[] = []
  for (const raw of splitTopLevel(body)) {
    const entry = withoutLeadingComments(raw)
    const match = /^(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]+)$/.exec(entry)
    if (!match) continue
    const name = match[1] ?? match[2]
    const config = match[3]
    const prop: ManifestProp = {
      name,
      type: vueRuntimeType(config),
      optional: !/\brequired\s*:\s*true\b/.test(config),
    }
    const defaultMatch = /\bdefault\s*:\s*([^,}\n]+)/.exec(config)
    const value = defaultMatch ? literalDefault(defaultMatch[1]) : undefined
    if (value !== undefined) prop.default = value
    const values = resolveEnumValues(prop.type, aliases)
    if (values?.length) prop.enum = values
    props.push(prop)
  }
  return props
}

function parseObjectKeys(body: string): string[] {
  const keys: string[] = []
  for (const raw of splitTopLevel(body)) {
    const entry = withoutLeadingComments(raw)
    const match = /^(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$]*))\s*:/.exec(entry)
    if (match) keys.push(match[1] ?? match[2])
  }
  return keys
}

function extractVueContracts(repoRoot: string, result: ContractMap): void {
  const roots = adapterRoots(repoRoot, 'vue')
  const exported = publicTypes(roots)
  const aliases = extractTypeAliases([join(repoRoot, 'packages/core/src'), ...roots])
  for (const root of roots) {
    for (const file of walk(root, /\.tsx?$/)) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(
        /export\s+const\s+(Iris[A-Za-z0-9]+)\s*=\s*defineComponent\s*\(\s*\{/g,
      )) {
        const name = match[1]
        const body = interfaceBody(text, match.index! + match[0].length - 1)
        const props = parseVueProps(objectPropertyBody(body, 'props'), aliases)
        const events = parseObjectKeys(objectPropertyBody(body, 'emits'))
        const slots = [
          ...body.matchAll(/\bslots\.([A-Za-z_$][\w$]*)/g),
          ...body.matchAll(/\bslots\[['"]([^'"]+)['"]\]/g),
        ].map((slot) => slot[1])
        addContract(result, name, 'vue', nativeContract(props, exported, name, events, slots))
      }
    }
  }
}

function matchingBraceEnd(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function aliasesFromText(text: string, target: Map<string, string>): void {
  for (const match of text.matchAll(/(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*=\s*([^;\n]+);?/g)) {
    if (!target.has(match[1])) target.set(match[1], match[2].replace(/\s+/g, ' ').trim())
  }
}

function svelteDefaults(text: string): Map<string, string> {
  const defaults = new Map<string, string>()
  const match = /\blet\s*\{/.exec(text)
  if (!match) return defaults
  const open = match.index + match[0].length - 1
  const end = matchingBraceEnd(text, open)
  if (end < 0 || !/=\s*\$props\(\)/.test(text.slice(end + 1, end + 500))) return defaults
  for (const part of splitTopLevel(text.slice(open + 1, end))) {
    const assignment = /^\s*([A-Za-z_$][\w$]*)(?:\s*:\s*[A-Za-z_$][\w$]*)?\s*=\s*([\s\S]+)$/.exec(
      part,
    )
    if (!assignment) continue
    const value = literalDefault(assignment[2])
    if (value !== undefined) defaults.set(assignment[1], value)
  }
  return defaults
}

/** Inline `: { ... }` contract, or a conservative name-only `$props` shape. */
function svelteInlineProps(text: string): ManifestProp[] | undefined {
  const match = /\blet\s*\{/.exec(text)
  if (!match) return undefined
  const open = match.index + match[0].length - 1
  const end = matchingBraceEnd(text, open)
  if (end < 0) return undefined
  const tail = text.slice(end + 1)
  const typed = /^\s*:\s*\{/.exec(tail)
  if (typed) {
    const typeOpen = typed.index + typed[0].length - 1
    return parsePropsBody(interfaceBody(tail, typeOpen))
  }
  if (!/^\s*=\s*\$props\(\)/.test(tail)) return undefined

  const props: ManifestProp[] = []
  for (const part of splitTopLevel(text.slice(open + 1, end))) {
    const entry = withoutLeadingComments(part)
    if (!entry || entry.startsWith('...')) continue
    const matchProp = /^([A-Za-z_$][\w$]*)(?:\s*:\s*[A-Za-z_$][\w$]*)?(?:\s*=\s*[\s\S]+)?$/.exec(
      entry,
    )
    if (!matchProp) continue
    props.push({ name: matchProp[1], type: 'unknown', optional: true })
  }
  return props
}

function svelteComponents(roots: string[]): Map<string, string> {
  const files = new Map<string, string>()
  for (const root of roots) {
    for (const barrel of walk(root, /^index\.ts$/)) {
      const text = readFileSync(barrel, 'utf8')
      for (const match of text.matchAll(
        /export\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+\.svelte)['"]/g,
      )) {
        const exported = /\bdefault\s+as\s+(Iris[A-Za-z0-9]+)/.exec(match[1])
        if (exported) files.set(exported[1], resolve(dirname(barrel), match[2]))
      }
    }
    for (const file of walk(root, /\.svelte$/)) {
      const name = basename(file, '.svelte')
      if (/^Iris[A-Za-z0-9]+$/.test(name) && !files.has(name)) files.set(name, file)
    }
  }
  return files
}

function extractSvelteContracts(repoRoot: string, result: ContractMap): void {
  const roots = adapterRoots(repoRoot, 'svelte')
  const exported = publicTypes(roots)
  const sharedAliases = extractTypeAliases([join(repoRoot, 'packages/core/src'), ...roots])
  const declaredProps = extractInterfaceComponentProps(repoRoot, 'svelte')
  for (const [name, file] of svelteComponents(roots)) {
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    const match = new RegExp(`\\binterface\\s+(?:Props|${name}Props)\\b[^\\{]*\\{`).exec(text)
    const aliases = new Map(sharedAliases)
    aliasesFromText(text, aliases)
    const localProps = match
      ? parsePropsBody(interfaceBody(text, match.index + match[0].length - 1))
      : (declaredProps.get(name) ?? svelteInlineProps(text))
    if (!localProps) continue
    const props = enrichProps(
      localProps.map((prop) => ({ ...prop })),
      aliases,
      svelteDefaults(text),
    )
    addContract(result, name, 'svelte', nativeContract(props, exported, name))
  }
}

/**
 * Extract the native public calling surface from every adapter. Missing entries
 * stay missing rather than borrowing React props; consumers can therefore
 * distinguish "no native contract extracted" from a real empty contract.
 */
export function extractFrameworkContracts(repoRoot: string): ContractMap {
  const result: ContractMap = new Map()
  extractInterfaceContracts(repoRoot, result)
  extractVueContracts(repoRoot, result)
  extractSvelteContracts(repoRoot, result)

  // Deterministic framework key insertion for stable JSON.
  for (const [name, contracts] of result) {
    const ordered: Partial<Record<Framework, ManifestFrameworkContract>> = {}
    for (const framework of ALL_FRAMEWORKS) {
      if (contracts[framework]) ordered[framework] = contracts[framework]
    }
    result.set(name, ordered)
  }
  return result
}
