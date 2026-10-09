import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'
import { resolveComponentSize, type Size } from '@iris-ui-kit/core'
export { DEFAULT_COMPONENT_SIZE, resolveComponentSize } from '@iris-ui-kit/core'

/** The component size scale shared by every size-bearing Iris control. */
export type IrisComponentSize = Size

/**
 * Injection key for the size handed down by the nearest `<IrisProvider
 * componentSize>`. The provided value is ALWAYS a concrete size (the prop, the
 * inherited one, or `md`), so a nested provider without `componentSize`
 * inherits its parent and a control with no provider still resolves to `md`.
 *
 * Named `…KEY` so the manifest's discover step never mistakes it for a
 * component export.
 */
export const ComponentSizeKey: InjectionKey<ComputedRef<IrisComponentSize>> =
  Symbol('IrisComponentSize')

/** Either a plain size or a getter (Vue props must be read reactively). */
export type ComponentSizeSource = IrisComponentSize | (() => IrisComponentSize | undefined)

function readSource(source: ComponentSizeSource | undefined): IrisComponentSize | undefined {
  return typeof source === 'function' ? source() : source
}

/**
 * The size a control should render at. Pass the component's own `size` prop —
 * as a getter (`() => props.size`) so prop changes stay reactive. An
 * `undefined` result means "inherit from the nearest provider". With no
 * provider at all the size is `md`.
 */
export function useComponentSize(explicit?: ComponentSizeSource): ComputedRef<IrisComponentSize> {
  const inherited = inject(ComponentSizeKey, null)
  return computed(() => resolveComponentSize(readSource(explicit), inherited?.value ?? null))
}
