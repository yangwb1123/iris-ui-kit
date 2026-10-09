import { createContext, useContext, type Accessor } from 'solid-js'
import { resolveComponentSize, type Size } from '@iris-ui-kit/core'
export { DEFAULT_COMPONENT_SIZE, resolveComponentSize } from '@iris-ui-kit/core'

/** The component size scale shared by every size-bearing Iris control. */
export type IrisComponentSize = Size

/**
 * Resolved size handed down by the nearest `<IrisProvider componentSize>`.
 *
 * `undefined` means "no provider above me" → consumers fall back to
 * {@link DEFAULT_COMPONENT_SIZE}. A provider ALWAYS provides a concrete size
 * (its own prop, else the one it inherited, else the default), which is what
 * makes a nested provider without a `componentSize` inherit its parent.
 *
 * The value is an accessor so reads stay reactive inside JSX without
 * re-creating the context object. Name ends in `Context` so the manifest's
 * discover step never mistakes it for a component export.
 */
export const ComponentSizeContext = createContext<Accessor<IrisComponentSize>>()

/**
 * The size a control should render at. Pass the component's own `size` prop;
 * `undefined` means "inherit from the nearest provider". The result is a
 * reactive accessor, so a provider prop change re-renders the control.
 */
export function useComponentSize(
  explicit?: Accessor<IrisComponentSize | undefined>,
): Accessor<IrisComponentSize> {
  const inherited = useContext(ComponentSizeContext)
  return () => resolveComponentSize(explicit?.(), inherited?.())
}
