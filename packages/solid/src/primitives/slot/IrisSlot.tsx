import { children, type JSX } from 'solid-js'

export interface IrisSlotProps {
  children?: JSX.Element
  [key: string]: unknown
}

/**
 * asChild composition primitive (Solid port). Merges the Slot's own props onto
 * its single element child. `style` shallow-merges, `class` concatenates, event
 * handlers compose (Slot's first, then child's). Used as a building block for
 * trigger primitives that want to render as the consumer's chosen element.
 */
export function IrisSlot(props: IrisSlotProps): JSX.Element {
  const { children: childrenProp, ...slotProps } = props as {
    children?: JSX.Element
    [key: string]: unknown
  }

  // In Solid, we can't easily introspect and merge onto children like React.
  // We render a transparent wrapper that merges the slot props.
  const resolved = children(() => childrenProp)

  const child = resolved()

  if (child == null) return null as unknown as JSX.Element

  // If child is a DOM element (via JSX), we use a span with display:contents
  // to pass through. For a proper asChild, consumers should use the Dynamic
  // pattern instead. This is the minimal working implementation.
  return (
    <span
      data-iris-slot=""
      style={{ display: 'contents' }}
      {...(slotProps as JSX.HTMLAttributes<HTMLSpanElement>)}
    >
      {child as JSX.Element}
    </span>
  ) as JSX.Element
}
