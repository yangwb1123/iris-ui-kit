import {
  COLOR_TOKENS,
  SPACING_TOKENS,
  RADII_TOKENS,
  SHADOW_TOKENS,
  ZINDEX_TOKENS,
  TRANSITION_TOKENS,
} from '@iris-ui-kit/tokens'
import type {
  IrisTheme,
  IrisThemeType,
  ColorToken,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  ZIndexToken,
  TransitionToken,
} from '@iris-ui-kit/tokens'
import type { Skin, ResolvedSkin } from './types'
import { skinError, SkinResolutionError } from './errors'

export interface SkinLookup {
  get(id: string): Skin | undefined
}

/** Extract required tokens; push missing keys onto `missing`. */
function collectRequiredTokens(
  tokens: Record<string, string | number>,
  keys: readonly string[],
  type: 'string' | 'number',
  missing: string[],
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const key of keys) {
    const v = tokens[key]
    if (typeof v !== type) missing.push(key)
    else out[key] = v
  }
  return out
}

/** Extract optional tokens; return undefined if none are present. */
function collectOptionalTokens(
  tokens: Record<string, string | number>,
  keys: readonly string[],
  type: 'string' | 'number',
): Record<string, string | number> | undefined {
  if (!keys.some((k) => k in tokens)) return undefined
  const out: Record<string, string | number> = {}
  for (const key of keys) {
    const v = tokens[key]
    if (typeof v === type) out[key] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Resolve a skin's `extends` chain (base→leaf, child wins) into a complete
 * `ResolvedSkin`. Pure. Throws `SkinResolutionError` on cycle / missing parent
 * / incompleteness — callers (registry, engine) always wrap.
 */
export function resolveSkin(skin: Skin, registry: SkinLookup): ResolvedSkin {
  const lineage: string[] = []
  const tokens: Record<string, string | number> = {}
  const custom: Record<string, string | number> = {}
  let type: IrisThemeType | undefined
  let icons: string | undefined
  let iconOverrides: Record<string, string> | undefined
  let variants: { light?: string; dark?: string } | undefined
  const path = new Set<string>()

  function walk(node: Skin): void {
    if (path.has(node.id)) {
      throw new SkinResolutionError(
        skinError('cycle', `cycle detected at skin "${node.id}"`, { id: node.id }),
      )
    }
    path.add(node.id)
    const parents =
      node.extends === undefined ? [] : Array.isArray(node.extends) ? node.extends : [node.extends]
    for (const pid of parents) {
      const parent = registry.get(pid)
      if (!parent) {
        throw new SkinResolutionError(
          skinError('missing-parent', `skin "${node.id}" extends unknown "${pid}"`, {
            id: node.id,
          }),
        )
      }
      walk(parent)
    }
    if (!lineage.includes(node.id)) lineage.push(node.id)
    if (node.tokens) Object.assign(tokens, node.tokens)
    if (node.custom) Object.assign(custom, node.custom)
    if (node.type !== undefined) type = node.type
    if (node.icons !== undefined) icons = node.icons
    if (node.iconOverrides !== undefined) iconOverrides = node.iconOverrides
    if (node.variants !== undefined) variants = node.variants
    path.delete(node.id)
  }

  walk(skin)

  const missing: string[] = []
  const colors = collectRequiredTokens(tokens, COLOR_TOKENS, 'string', missing) as Record<
    ColorToken,
    string
  >
  const spacing = collectRequiredTokens(tokens, SPACING_TOKENS, 'number', missing) as Record<
    SpacingToken,
    number
  >
  const radii = collectRequiredTokens(
    tokens,
    RADII_TOKENS as unknown as string[],
    'number',
    missing,
  ) as Record<RadiusToken, number>
  // Optional sections — not required (no missing entry for these)
  const shadows = collectOptionalTokens(tokens, SHADOW_TOKENS, 'string') as
    Record<ShadowToken, string> | undefined
  const zIndex = collectOptionalTokens(tokens, ZINDEX_TOKENS, 'number') as
    Record<ZIndexToken, number> | undefined
  const transitions = collectOptionalTokens(tokens, TRANSITION_TOKENS, 'string') as
    Record<TransitionToken, string> | undefined
  if (missing.length > 0) {
    throw new SkinResolutionError(
      skinError('incomplete', `skin "${skin.id}" missing tokens: ${missing.join(', ')}`, {
        id: skin.id,
        keys: missing,
      }),
    )
  }

  const resolvedType: IrisThemeType = type ?? 'light'
  const theme: IrisTheme = {
    name: skin.id,
    type: resolvedType,
    colors,
    spacing,
    radii,
    ...(shadows !== undefined ? { shadows } : {}),
    ...(zIndex !== undefined ? { zIndex } : {}),
    ...(transitions !== undefined ? { transitions } : {}),
    ...(icons !== undefined ? { icons } : {}),
    ...(iconOverrides !== undefined ? { iconOverrides } : {}),
  }
  return {
    id: skin.id,
    name: skin.name ?? skin.id,
    type: resolvedType,
    theme,
    custom,
    lineage,
    ...(variants !== undefined ? { variants } : {}),
    source: skin,
  }
}
