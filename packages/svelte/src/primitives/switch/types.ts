import type { HTMLInputAttributes } from 'svelte/elements'

export type IrisSwitchSize = 'sm' | 'md' | 'lg'

export interface IrisSwitchProps extends Omit<
  HTMLInputAttributes,
  'type' | 'size' | 'value' | 'checked' | 'onchange' | 'children'
> {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (next: boolean, event: Event) => void
  /**
   * Explicit size. Omit to inherit the nearest `<IrisProvider componentSize>`
   * (`md` when there is none).
   */
  size?: IrisSwitchSize
  invalid?: boolean
  ariaDescribedby?: string
}
