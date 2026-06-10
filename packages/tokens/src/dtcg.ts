import type { IrisTheme } from './types'
import { COLOR_TOKENS, SPACING_TOKENS, RADII_TOKENS, type AnyToken } from './tokens'

/**
 * W3C Design Tokens Community Group (DTCG) export.
 *
 * Turns an {@link IrisTheme} into the interoperable `$type` / `$value` tree
 * consumed by Style Dictionary, Tokens Studio, Figma Code Connect, etc. This
 * is the design-token interop layer: author once in Iris, hand the JSON to any
 * DTCG-aware tool.
 *
 * Dimensions (spacing / radii) are emitted as `px` strings, the lowest common
 * denominator every DTCG tool reads. Colors are emitted as hex strings.
 */
export type DtcgType = 'color' | 'dimension'

export interface DtcgToken {
  $type: DtcgType
  $value: string
  $description?: string
}

export interface DtcgGroup {
  [key: string]: DtcgGroup | DtcgToken
}

/** Tailwind-style key for a base token that also has variants (e.g. `surface`). */
const DEFAULT_KEY = 'DEFAULT'

function isToken(node: DtcgGroup | DtcgToken): node is DtcgToken {
  return typeof (node as DtcgToken).$value === 'string'
}

/**
 * Insert `token` at the dotted `path` inside `root`, creating intermediate
 * groups as needed. When a name is also a prefix of another token (so the
 * intermediate node is already — or becomes — a token), the base token is
 * relocated to a `DEFAULT` child so the node can be a valid group. This keeps
 * the output spec-valid: a DTCG token never contains child tokens.
 */
function insert(root: DtcgGroup, path: string[], token: DtcgToken): void {
  let node = root
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]
    const existing = node[seg]
    if (existing === undefined) {
      node[seg] = {}
    } else if (isToken(existing)) {
      // A shorter token name turned out to be a prefix — demote it to DEFAULT.
      node[seg] = { [DEFAULT_KEY]: existing }
    }
    node = node[seg] as DtcgGroup
  }
  const leaf = path[path.length - 1]
  const existing = node[leaf]
  if (existing !== undefined && !isToken(existing)) {
    // A longer token already created this as a group — nest as DEFAULT.
    ;(existing as DtcgGroup)[DEFAULT_KEY] = token
  } else {
    node[leaf] = token
  }
}

function colorToken(theme: IrisTheme, name: AnyToken): DtcgToken {
  return { $type: 'color', $value: theme.colors[name as keyof typeof theme.colors] }
}

function dimensionToken(value: number): DtcgToken {
  return { $type: 'dimension', $value: `${value}px` }
}

/**
 * Convert an Iris theme into a DTCG token document.
 *
 * @example
 * ```ts
 * import { toDtcg, lightTheme } from '@iris-ui/tokens'
 * const dtcg = toDtcg(lightTheme)
 * // dtcg.iris.surface.DEFAULT -> { $type: 'color', $value: '#f8fafc' }
 * // dtcg.iris.surface.hover   -> { $type: 'color', $value: '#f1f5f9' }
 * // dtcg.iris.gap.sm          -> { $type: 'dimension', $value: '4px' }
 * ```
 */
export function toDtcg(theme: IrisTheme): DtcgGroup {
  const root: DtcgGroup = {}
  for (const name of COLOR_TOKENS) {
    insert(root, name.split('.'), colorToken(theme, name))
  }
  for (const name of SPACING_TOKENS) {
    insert(root, name.split('.'), dimensionToken(theme.spacing[name]))
  }
  for (const name of RADII_TOKENS) {
    insert(root, name.split('.'), dimensionToken(theme.radii[name]))
  }
  return root
}

/** Serialize {@link toDtcg} to a pretty-printed JSON string (a `.tokens.json` file). */
export function toDtcgJson(theme: IrisTheme): string {
  return JSON.stringify(toDtcg(theme), null, 2)
}
