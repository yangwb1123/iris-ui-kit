/**
 * IrisTable keyboard shortcut rebinding (batch BG, iris 独有 — vxe
 * keyboardConfig has no rebinding): every built-in table shortcut is
 * declaratively remappable through the `keymap` prop. Pure, framework-free
 * functions live in core; adapters query them per keydown.
 *
 * Key-spec grammar: `Modifier+Key`. Modifiers: `Ctrl`/`Cmd`/`Meta` (ONE
 * ctrl-or-meta flag — `Ctrl+C` matches Ctrl OR Cmd, byte-identical to the
 * table's historic `ctrlKey || metaKey` reads), `Shift`, `Alt`/`Option`.
 * The key part is case-insensitive (`F3`/`f3`, `Delete`, `d`). Modifiers
 * match EXACTLY: `Ctrl+Shift+Z` redoes and never undoes; `Alt+Ctrl+Z` is
 * inert; a bare `F2` never fires with Shift held. Invalid specs (`''`,
 * `'Meta'`, `'Ctrl+'`, whitespace…) are dropped fail-closed — the action
 * keeps its default binding.
 */

/** The rebindable built-in shortcut actions. */
export type IrisTableKeyAction =
  'edit' | 'clear' | 'undo' | 'redo' | 'copy' | 'paste' | 'fill' | 'query'

/** Prop-shaped partial keymap: ONE key spec string per action. */
export type IrisTableKeymap = Partial<Record<IrisTableKeyAction, string>>

/** A parsed key spec: lowercase key + exact modifier flags. */
export interface TableKeyBinding {
  /** Lowercased key (event-key normalized, `' '` → `'space'`). */
  key: string
  /** Ctrl or Meta (one shared flag). */
  ctrl: boolean
  /** Shift held — must match EXACTLY. */
  shift: boolean
  /** Alt (Option) held — must match EXACTLY. */
  alt: boolean
}

/** Minimal KeyboardEvent shape `matchTableKey` reads. */
export interface TableKeyEvent {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

/** Normalized map: every action → its effective bindings (defaults + overrides). */
export interface NormalizedTableKeymap {
  edit: readonly TableKeyBinding[]
  clear: readonly TableKeyBinding[]
  undo: readonly TableKeyBinding[]
  redo: readonly TableKeyBinding[]
  copy: readonly TableKeyBinding[]
  paste: readonly TableKeyBinding[]
  fill: readonly TableKeyBinding[]
  query: readonly TableKeyBinding[]
}

/** The 8 rebindable actions in canonical order (normalization iteration).
 * Arbitration between handlers is by wiring order (root handlers claim a key
 * with preventDefault before window listeners see it) — NOT by this array. */
export const TABLE_KEY_ACTIONS: readonly IrisTableKeyAction[] = [
  'edit',
  'clear',
  'undo',
  'redo',
  'copy',
  'paste',
  'fill',
  'query',
]

/** Default bindings (string form). `clear`/`redo` carry aliases. */
export const DEFAULT_TABLE_KEYMAP: Record<IrisTableKeyAction, readonly string[]> = {
  edit: ['F2'],
  clear: ['Delete', 'Backspace'],
  undo: ['Ctrl+Z'],
  redo: ['Ctrl+Y', 'Ctrl+Shift+Z'],
  copy: ['Ctrl+C'],
  paste: ['Ctrl+V'],
  fill: ['Ctrl+D'],
  query: ['Ctrl+K'],
}

/** Parse one key spec. Invalid specs (no key part, unknown tokens…) → null. */
export function parseTableKey(spec: string): TableKeyBinding | null {
  if (typeof spec !== 'string') return null
  const parts = spec.split('+').map((part) => part.trim().toLowerCase())
  // Empty segments are malformed, but whitespace around a real segment is
  // deliberately accepted (`Ctrl + Shift + Z`).
  if (parts.length === 0 || parts.some((part) => part === '')) return null
  let ctrl = false
  let shift = false
  let alt = false
  const keys: string[] = []
  for (const part of parts) {
    if (part === 'ctrl' || part === 'cmd' || part === 'meta') ctrl = true
    else if (part === 'shift') shift = true
    else if (part === 'alt' || part === 'option') alt = true
    else keys.push(part)
  }
  // Exactly ONE non-modifier token — `'Meta'`/`'Ctrl+'`/`'F3+F4'` are invalid.
  if (keys.length !== 1) return null
  return { key: keys[0]!, ctrl, shift, alt }
}

function isTableKeyBinding(value: unknown): value is TableKeyBinding {
  if (typeof value !== 'object' || value === null) return false
  const binding = value as Record<string, unknown>
  return (
    typeof binding.key === 'string' &&
    binding.key.length > 0 &&
    typeof binding.ctrl === 'boolean' &&
    typeof binding.shift === 'boolean' &&
    typeof binding.alt === 'boolean'
  )
}

function parseAll(specs: readonly string[]): TableKeyBinding[] {
  const out: TableKeyBinding[] = []
  for (const spec of specs) {
    const binding = parseTableKey(spec)
    if (binding !== null) out.push(binding)
  }
  return out
}

/**
 * Effective keymap = defaults + overrides. An override REPLACES that action's
 * bindings wholesale (aliases included); an all-invalid override is dropped
 * fail-closed and the action keeps its default.
 */
export function normalizeKeymap(overrides?: IrisTableKeymap): NormalizedTableKeymap {
  const out = {} as NormalizedTableKeymap
  for (const action of TABLE_KEY_ACTIONS) {
    const hasOwnOverride =
      overrides !== null &&
      overrides !== undefined &&
      Object.prototype.hasOwnProperty.call(overrides, action)
    const override = hasOwnOverride ? overrides[action] : undefined
    const source = typeof override === 'string' ? [override] : DEFAULT_TABLE_KEYMAP[action]
    const parsed = parseAll(source)
    out[action] = parsed.length > 0 ? parsed : parseAll(DEFAULT_TABLE_KEYMAP[action])
  }
  return out
}

/**
 * Format ONE binding as a display string (batch CJ, iris 独有 — vxe has no
 * shortcut help): modifier order `Ctrl`/`Shift`/`Alt`, the key part
 * display-cased (`' '` → `Space`, single letters uppercased, other keys
 * capitalized: `f2` → `F2`, `delete` → `Delete`). The single ctrl-or-meta
 * flag always renders as `Ctrl` (byte-identical with `parseTableKey`'s
 * shared-flag read). Round-trips every binding `normalizeKeymap` can emit.
 */
export function formatKeyBinding(binding: TableKeyBinding): string {
  if (!isTableKeyBinding(binding)) return ''
  const parts: string[] = []
  if (binding.ctrl) parts.push('Ctrl')
  if (binding.shift) parts.push('Shift')
  if (binding.alt) parts.push('Alt')
  const key = binding.key === ' ' ? 'space' : binding.key.trim().toLowerCase()
  if (key === '') return ''
  if (key === 'space') parts.push('Space')
  else if (key.length === 1) parts.push(key.toUpperCase())
  else parts.push(key.charAt(0).toUpperCase() + key.slice(1))
  return parts.join('+')
}

/** Format a binding LIST as a display string: `' / '`-joined aliases, empty → `''`. */
export function formatKeyBindings(bindings: readonly TableKeyBinding[]): string {
  if (!Array.isArray(bindings)) return ''
  return bindings
    .map(formatKeyBinding)
    .filter((formatted) => formatted !== '')
    .join(' / ')
}

/** Exact match: key (case-insensitive) + ALL modifier flags equal. */
export function matchTableKey(event: TableKeyEvent, bindings: readonly TableKeyBinding[]): boolean {
  if (
    typeof event !== 'object' ||
    event === null ||
    typeof event.key !== 'string' ||
    !Array.isArray(bindings)
  ) {
    return false
  }
  const key = event.key === ' ' ? 'space' : event.key.toLowerCase()
  const ctrl = event.ctrlKey === true || event.metaKey === true
  const shift = event.shiftKey === true
  const alt = event.altKey === true
  return bindings.some(
    (b) =>
      isTableKeyBinding(b) &&
      b.key === key &&
      b.ctrl === ctrl &&
      b.shift === shift &&
      b.alt === alt,
  )
}
