import { createContext, useContext } from 'react'
import { resolveComponentSize, type Size } from '@iris-ui-kit/core'
export { DEFAULT_COMPONENT_SIZE, resolveComponentSize } from '@iris-ui-kit/core'

/** The component size scale shared by every size-bearing Iris control. */
export type IrisComponentSize = Size

/**
 * Resolved size handed down by the nearest `<IrisProvider componentSize>`.
 *
 * `null` means "no provider above me" → consumers fall back to
 * {@link DEFAULT_COMPONENT_SIZE}. A provider ALWAYS provides a concrete size
 * (its own prop, else the one it inherited, else the default), which is what
 * makes a nested provider without a `componentSize` inherit its parent.
 */
export const ComponentSizeContext = createContext<IrisComponentSize | null>(null)

/**
 * The size a control should render at. Pass the component's own `size` prop;
 * `undefined` means "inherit from the nearest provider".
 */
export function useComponentSize(explicit?: IrisComponentSize): IrisComponentSize {
  return resolveComponentSize(explicit, useContext(ComponentSizeContext))
}
