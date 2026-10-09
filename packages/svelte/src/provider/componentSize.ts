import { getContext } from 'svelte'
import { resolveComponentSize, type Size } from '@iris-ui-kit/core'
export { DEFAULT_COMPONENT_SIZE, resolveComponentSize } from '@iris-ui-kit/core'

/** The component size scale shared by every size-bearing Iris control. */
export type IrisComponentSize = Size

/**
 * Context key for the size handed down by the nearest `<IrisProvider
 * componentSize>`. The value is an object with a getter so consumers read the
 * live derived value. Named `...KEY` (not `Iris*`) so the manifest discover
 * step never treats it as a component.
 */
export const COMPONENT_SIZE_KEY = Symbol('iris-ui:component-size')

/** What `IrisProvider` provides under {@link COMPONENT_SIZE_KEY}. */
export interface ComponentSizeContextValue {
  /** The size controls below this provider should use. Always concrete. */
  readonly current: IrisComponentSize
}

/**
 * The size a control should render at. Pass the component's own `size` prop;
 * `undefined` means "inherit from the nearest provider". Call from component
 * initialization (top level of `<script>`), like any Svelte context read.
 */
export function getComponentSize(explicit?: IrisComponentSize): IrisComponentSize {
  const ctx = getContext<ComponentSizeContextValue | undefined>(COMPONENT_SIZE_KEY)
  return resolveComponentSize(explicit, ctx?.current)
}
