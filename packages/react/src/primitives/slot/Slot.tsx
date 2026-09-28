import * as React from 'react'
import { mergeSlotProps, type SlotProps } from '@iris-ui-kit/core'

export interface IrisSlotProps {
  children?: React.ReactNode
  [key: string]: unknown
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined | null>): React.RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(value)
      else (ref as React.MutableRefObject<T | null>).current = value
    }
  }
}

/**
 * asChild composition primitive: clones the single React element child and
 * merges the Slot's own props into it.
 *
 * The merge rules are owned by `@iris-ui-kit/core` so React, Vue, Solid and
 * Svelte cannot drift apart: `className` concatenates parent-first, `style`
 * shallow-merges with the child last, handlers compose parent-first (a parent
 * `preventDefault()` skips the child), and every other prop on the child wins.
 * React's two adaptations are passed as options — it spells classes
 * `className` and assigns a style *object* to the element.
 *
 * Ref fan-out stays here because React refs are callback functions or mutable
 * objects, which core deliberately does not model.
 */
export const IrisSlot = React.forwardRef<unknown, IrisSlotProps>(function IrisSlot(
  { children, ...slotProps },
  forwardedRef,
) {
  if (!React.isValidElement(children)) return null
  const child = children as React.ReactElement<SlotProps>
  const childProps = (child.props ?? {}) as SlotProps
  const merged = mergeSlotProps(slotProps as SlotProps, childProps, {
    classKey: 'className',
    styleAsObject: true,
    preserveRef: true,
  })

  const childRef = (child as unknown as { ref?: React.Ref<unknown> }).ref ?? null
  if (forwardedRef || childRef) {
    ;(merged as { ref?: React.Ref<unknown> }).ref = mergeRefs(
      forwardedRef as React.Ref<unknown>,
      childRef,
    )
  }

  return React.cloneElement(child, merged as Partial<SlotProps> & React.Attributes)
})
