import { COLOR_TOKENS, SPACING_TOKENS, RADII_TOKENS } from '@iris-ui/tokens'
import type {
  IrisTheme,
  IrisThemeType,
  ColorToken,
  SpacingToken,
  RadiusToken,
} from '@iris-ui/tokens'
import type { Skin, ResolvedSkin } from './types'
import { skinError, SkinResolutionError } from './errors'

export interface SkinLookup {
  get(id: string): Skin | undefined
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
  const colors = {} as Record<ColorToken, string>
  const spacing = {} as Record<SpacingToken, number>
  const radii = {} as Record<RadiusToken, number>
  for (const key of COLOR_TOKENS) {
    const v = tokens[key]
    if (typeof v !== 'string') missing.push(key)
    else colors[key] = v
  }
  for (const key of SPACING_TOKENS) {
    const v = tokens[key]
    if (typeof v !== 'number') missing.push(key)
    else spacing[key] = v
  }
  for (const key of RADII_TOKENS) {
    const v = tokens[key]
    if (typeof v !== 'number') missing.push(key)
    else radii[key] = v
  }
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
