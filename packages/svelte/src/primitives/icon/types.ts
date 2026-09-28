import type { IrisIconPickerCategory, IrisIconRegistry } from '@iris-ui-kit/icons'

export interface IrisIconProps {
  /** Semantic icon name resolved via the registry (e.g. 'check', 'chevron-down'). */
  name: string
  /** Width & height (number → px). Default 24. */
  size?: number | string
  /** Stroke width for line icons. Default 2. */
  strokeWidth?: number
  /** Render as a filled glyph instead of a stroked line icon. */
  fill?: boolean
  /** Accessible title; sets `role="img"` + `aria-label`. Omit for decorative icons. */
  title?: string
  /** Registry to resolve `name` against. Defaults to the built-in set. */
  registry?: IrisIconRegistry
  class?: string
  /** Inline CSS string (Svelte convention), appended after the base icon style. */
  style?: string
}

export interface IrisIconPickerProps {
  value?: string
  defaultValue?: string
  onValueChange?: (name: string) => void
  registry?: IrisIconRegistry
  iconNames?: readonly string[]
  categories?: readonly IrisIconPickerCategory[]
  columns?: number
  disabled?: boolean
  label?: string
  searchLabel?: string
  placeholder?: string
  emptyText?: string
  class?: string
  style?: string
  [key: string]: unknown
}
