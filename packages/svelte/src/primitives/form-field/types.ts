import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

export interface IrisFormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  /** Override the auto-generated control id. */
  labelFor?: string
  size?: 'sm' | 'md'
  children?: Snippet
}
