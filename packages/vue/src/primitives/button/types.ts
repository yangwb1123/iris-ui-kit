import type { Size, Variant } from '@iris-ui/core'

export type IrisButtonVariant = Variant
export type IrisButtonSize = Size
export type IrisButtonType = 'button' | 'submit' | 'reset'

export interface IrisButtonProps {
  /** Visual variant. Defaults to `'solid'`. */
  variant?: IrisButtonVariant
  /** Size scale. Defaults to `'md'`. */
  size?: IrisButtonSize
  /** When true, the button is non-interactive and visually muted. */
  disabled?: boolean
  /**
   * Replaces the leading slot with a spinner and sets `aria-busy="true"`.
   * Implies non-interactive (clicks are swallowed).
   */
  loading?: boolean
  /**
   * Native button type. **Defaults to `'button'`** (not `'submit'`) to guard
   * against accidental form submissions when this primitive is dropped into
   * an existing `<form>`. Set explicitly to `'submit'` when wiring up a form.
   */
  type?: IrisButtonType
  /**
   * Polymorphic mode. When true, Button does not render a `<button>` element
   * — instead it merges its class/style/data-attrs/event handlers onto the
   * single child of the default slot. Use this to apply Button styling to a
   * `<RouterLink>`, an `<a href>`, or any custom element while keeping the
   * a11y + interaction semantics.
   *
   * The `leading` slot is ignored in this mode; the consumer owns the
   * markup. `loading` still sets `aria-busy` and swallows clicks but does
   * not change the visual.
   */
  asChild?: boolean
}
