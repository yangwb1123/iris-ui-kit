import * as React from 'react'
import { composeEventHandlers } from '@iris-ui/core'

type AnyProps = Record<string, unknown>

export interface IrisSlotProps {
  children?: React.ReactNode
  [key: string]: unknown
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined | null>
): React.RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(value)
      else (ref as React.MutableRefObject<T | null>).current = value
    }
  }
}

function isEventHandlerName(key: string): boolean {
  return /^on[A-Z]/.test(key)
}

function mergeSlotProps(slot: AnyProps, child: AnyProps): AnyProps {
  const merged: AnyProps = { ...slot }
  for (const key of Object.keys(child)) {
    const slotValue = slot[key]
    const childValue = child[key]
    if (key === 'style') {
      merged.style = {
        ...((slotValue as React.CSSProperties | undefined) ?? {}),
        ...((childValue as React.CSSProperties | undefined) ?? {}),
      }
    } else if (key === 'className') {
      merged.className = [slotValue, childValue].filter(Boolean).join(' ').trim() || undefined
    } else if (
      isEventHandlerName(key) &&
      typeof slotValue === 'function' &&
      typeof childValue === 'function'
    ) {
      merged[key] = composeEventHandlers(
        slotValue as (e: React.SyntheticEvent) => void,
        childValue as (e: React.SyntheticEvent) => void,
      )
    } else if (childValue !== undefined) {
      merged[key] = childValue
    }
  }
  return merged
}

/**
 * asChild composition primitive: clones the single React element child and
 * merges the Slot's own props into it. `style` shallow-merges, `className`
 * concatenates, event handlers compose (Slot's first, then child's), and any
 * other prop on the child wins over Slot's. Used as a building block for
 * trigger primitives that want to render-as the consumer's chosen element.
 */
export const IrisSlot = React.forwardRef<unknown, IrisSlotProps>(function IrisSlot(
  { children, ...slotProps },
  forwardedRef,
) {
  if (!React.isValidElement(children)) return null
  const child = children as React.ReactElement<AnyProps>
  const childProps = (child.props ?? {}) as AnyProps
  const merged = mergeSlotProps(slotProps as AnyProps, childProps)

  const childRef = (child as unknown as { ref?: React.Ref<unknown> }).ref ?? null
  if (forwardedRef || childRef) {
    ;(merged as { ref?: React.Ref<unknown> }).ref = mergeRefs(
      forwardedRef as React.Ref<unknown>,
      childRef,
    )
  }

  return React.cloneElement(child, merged as Partial<AnyProps> & React.Attributes)
})
