import { COLOR_TOKENS, SPACING_TOKENS, RADII_TOKENS } from '@iris-ui/tokens'
import type { Skin } from './types'
import { skinError, type SkinError } from './errors'

const COLOR_SET = new Set<string>(COLOR_TOKENS)
const DIMENSION_SET = new Set<string>([...SPACING_TOKENS, ...RADII_TOKENS])
const CORE_SET = new Set<string>([...COLOR_TOKENS, ...SPACING_TOKENS, ...RADII_TOKENS])
const DOT_KEY = /^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*)*$/

/** Pure shape/type/key validation. Returns errors (empty = valid). Never throws. */
export function validateSkin(skin: Skin): SkinError[] {
  const errors: SkinError[] = []
  const id = skin?.id
  if (typeof id !== 'string' || id.length === 0) {
    errors.push(skinError('validate', 'skin.id must be a non-empty string'))
  }
  if (skin.type !== undefined && skin.type !== 'light' && skin.type !== 'dark') {
    errors.push(skinError('validate', "skin.type must be 'light' or 'dark'", { id }))
  }
  if (skin.extends !== undefined) {
    const parents = Array.isArray(skin.extends) ? skin.extends : [skin.extends]
    for (const p of parents) {
      if (typeof p !== 'string' || p.length === 0) {
        errors.push(skinError('validate', 'skin.extends entries must be non-empty strings', { id }))
      }
    }
  }
  if (skin.tokens !== undefined) {
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
  }
  if (skin.custom !== undefined) {
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
  }
  if (skin.variants !== undefined) {
    for (const k of ['light', 'dark'] as const) {
      const v = skin.variants[k]
      if (v !== undefined && (typeof v !== 'string' || v.length === 0)) {
        errors.push(skinError('validate', `variants.${k} must be a non-empty string`, { id }))
      }
    }
  }
  return errors
}
