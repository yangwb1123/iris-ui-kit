import type { FieldSpec } from '../core'

/**
 * Shared field helpers for the Svelte {@link IrisFormBuilder} renderer. Split out
 * of the component (ADR-008: no oversized source files) and mirrors the React
 * reference's `fields.tsx` helpers so sub-field labels + nested paths are derived
 * identically across frameworks.
 */

/** Humanize a camelCase / snake_case name into a Title Case label. */
function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** The resolved label for a field (explicit, else humanized from its name). */
export const labelOf = (field: FieldSpec): string => field.label ?? humanize(field.name)

/**
 * The full path a field binds to: a top-level field is just its `name`; a
 * sub-field inside an array row is `${prefix}.${name}` where `prefix` is the row
 * path (`items[2]`). `useField` parses both into the same canonical key.
 */
export const pathOf = (field: FieldSpec, prefix?: string): string =>
  prefix ? `${prefix}.${field.name}` : field.name
