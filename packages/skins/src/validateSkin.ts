import {
  COLOR_TOKENS,
  SPACING_TOKENS,
  RADII_TOKENS,
  SHADOW_TOKENS,
  ZINDEX_TOKENS,
  TRANSITION_TOKENS,
} from '@iris-ui-kit/tokens'
import type { Skin } from './types'
import { skinError, type SkinError } from './errors'

const COLOR_SET = new Set<string>(COLOR_TOKENS)
const DIMENSION_SET = new Set<string>([...SPACING_TOKENS, ...RADII_TOKENS, ...ZINDEX_TOKENS])
const CORE_SET = new Set<string>([
  ...COLOR_TOKENS,
  ...SPACING_TOKENS,
  ...RADII_TOKENS,
  ...SHADOW_TOKENS,
  ...ZINDEX_TOKENS,
  ...TRANSITION_TOKENS,
])
const DOT_KEY = /^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*)*$/

function validateId(id: unknown): string | undefined {
  if (typeof id !== 'string' || id.length === 0) return 'skin.id must be a non-empty string'
  return undefined
}

function validateType(skin: Skin, id: string | undefined): SkinError | undefined {
  if (skin.type !== undefined && skin.type !== 'light' && skin.type !== 'dark') {
    return skinError('validate', "skin.type must be 'light' or 'dark'", { id })
  }
  return undefined
}

function validateExtends(skin: Skin, id: string | undefined): SkinError[] {
  if (skin.extends === undefined) return []
  const parents = Array.isArray(skin.extends) ? skin.extends : [skin.extends]
  return parents
    .filter((p) => typeof p !== 'string' || p.length === 0)
    .map(() => skinError('validate', 'skin.extends entries must be non-empty strings', { id }))
}

function validateTokens(skin: Skin, id: string | undefined): SkinError[] {
  if (skin.tokens === undefined) return []
  const errors: SkinError[] = []
  for (const [key, value] of Object.entries(skin.tokens)) {
    if (!CORE_SET.has(key)) {
      errors.push(
        skinError('validate', `unknown core token "${key}" (use custom for extra tokens)`, {
          id,
          keys: [key],
        }),
      )
      continue
    }
    if (COLOR_SET.has(key) && typeof value !== 'string') {
      errors.push(
        skinError('validate', `color token "${key}" must be a string`, { id, keys: [key] }),
      )
    } else if (DIMENSION_SET.has(key) && typeof value !== 'number') {
      errors.push(
        skinError('validate', `dimension token "${key}" must be a number`, { id, keys: [key] }),
      )
    }
  }
  return errors
}

function validateCustom(skin: Skin, id: string | undefined): SkinError[] {
  if (skin.custom === undefined) return []
  const errors: SkinError[] = []
  for (const [key, value] of Object.entries(skin.custom)) {
    if (!DOT_KEY.test(key)) {
      errors.push(
        skinError('validate', `custom token key "${key}" is not valid dot-notation`, {
          id,
          keys: [key],
        }),
      )
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push(
        skinError('validate', `custom token "${key}" must be a string or number`, {
          id,
          keys: [key],
        }),
      )
    }
  }
  return errors
}

function validateVariants(skin: Skin, id: string | undefined): SkinError[] {
  if (skin.variants === undefined) return []
  const errors: SkinError[] = []
  for (const k of ['light', 'dark'] as const) {
    const v = skin.variants[k]
    if (v !== undefined && (typeof v !== 'string' || v.length === 0)) {
      errors.push(skinError('validate', `variants.${k} must be a non-empty string`, { id }))
    }
  }
  return errors
}

/** Pure shape/type/key validation. Returns errors (empty = valid). Never throws. */
export function validateSkin(skin: Skin): SkinError[] {
  const id = skin?.id
  const errors: SkinError[] = []
  const idErr = validateId(id)
  if (idErr) errors.push(skinError('validate', idErr))
  const typeErr = validateType(skin, id)
  if (typeErr) errors.push(typeErr)
  errors.push(...validateExtends(skin, id))
  errors.push(...validateTokens(skin, id))
  errors.push(...validateCustom(skin, id))
  errors.push(...validateVariants(skin, id))
  return errors
}
