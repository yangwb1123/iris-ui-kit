import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'
import type { FormFieldLabelPlacement, LayoutLength } from '@iris-ui-kit/core'

export interface IrisFormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  /** Override the auto-generated control id. */
  labelFor?: string
  size?: 'sm' | 'md'
  /** Label above the control (default) or beside it. */
  labelPlacement?: FormFieldLabelPlacement
  /** Width of the label column — a number is read as px. Labels wrap inside it. */
  labelWidth?: LayoutLength
  /** Width of the control area (control + hint/error); a number is read as px. */
  controlWidth?: LayoutLength
  /** Stretch the field (and its control area) to the container width. */
  fullWidth?: boolean
  children?: Snippet
}
