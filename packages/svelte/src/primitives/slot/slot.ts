import { createAttachmentKey, type Attachment } from 'svelte/attachments'
import {
  isEventProp,
  mergeClassIntoElement,
  mergeSlotProps,
  mergeStyleIntoElement,
  type SlotProps,
} from '@iris-ui-kit/core'

export type IrisSlotRef =
  | ((element: HTMLElement) =>
      | void
      | (() => void)
      | {
          destroy?: () => void
        })
  | {
      current: HTMLElement | null
    }

export type IrisSlotMergedProps = Record<string, unknown> & Record<symbol, Attachment<HTMLElement>>

/**
 * Props passed to an `asChild` snippet.
 *
 * A direct `{...slotProps}` spread remains supported for children that do not
 * redeclare `class`, `style`, or handlers. When the child supplies any of
 * those props, use `{...slotProps.merge({ ...childProps })}` so the merged
 * value is present during SSR as well as after hydration.
 */
export type IrisSlotChildProps = IrisSlotMergedProps & {
  readonly merge: (
    childProps?: Record<string, unknown>,
    childRef?: IrisSlotRef,
  ) => IrisSlotMergedProps
}

/**
 * Build the spreadable child contract used by Svelte `asChild` primitives.
 *
 * The merge *semantics* — class order, style order, handler composition, child
 * precedence — live in `@iris-ui-kit/core` so all four adapters agree. Svelte
 * keeps only the part it uniquely owns: an attachment for the work a plain
 * object spread cannot express (class/style merging on a live node, parent-first
 * event composition, ref fan-out).
 *
 * Non-event attributes stay enumerable so SSR emits them.
 */
export function createSlotChildProps(
  parentProps: SlotProps,
  ref?: IrisSlotRef,
): IrisSlotChildProps {
  const childProps: Record<string | symbol, unknown> = {}
  for (const [key, value] of Object.entries(parentProps)) {
    if (isEventProp(key)) {
      // Keep direct property access source-compatible without letting object
      // spread install a second copy of the handler. The attachment below owns
      // parent-first event composition.
      Object.defineProperty(childProps, key, { value, enumerable: false })
    } else if (key !== 'ref') {
      childProps[key] = value
    }
  }

  Object.defineProperty(childProps, 'merge', {
    enumerable: false,
    value: (
      explicitChildProps: Record<string, unknown> = {},
      childRef?: IrisSlotRef,
    ): IrisSlotMergedProps => mergeChildProps(parentProps, explicitChildProps, ref, childRef),
  })

  const attachmentKey = createAttachmentKey()
  childProps[attachmentKey] = ((node: HTMLElement) => {
    mergeClassIntoElement(node, parentProps.class)
    mergeStyleIntoElement(node, parentProps.style)

    const cleanups: Array<() => void> = [attachRef(node, ref)]
    for (const [key, value] of Object.entries(parentProps)) {
      if (!isEventProp(key) || typeof value !== 'function') continue
      const eventName = key
        .slice(2)
        .replace(/capture$/i, '')
        .toLowerCase()
      const handler = value as (event: Event) => void
      const listener = (event: Event): void => {
        handler(event)
        if (event.defaultPrevented) event.stopImmediatePropagation()
      }
      node.addEventListener(eventName, listener, { capture: true })
      cleanups.push(() => node.removeEventListener(eventName, listener, { capture: true }))
    }

    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }) satisfies Attachment<HTMLElement>

  return childProps as IrisSlotChildProps
}

function attachRef(node: HTMLElement, ref: IrisSlotRef | undefined): () => void {
  if (!ref) return () => undefined
  if (typeof ref === 'object') {
    ref.current = node
    return () => {
      ref.current = null
    }
  }

  const result = ref(node)
  if (typeof result === 'function') return result
  if (result?.destroy) return result.destroy
  return () => undefined
}

function attachRefs(node: HTMLElement, refs: Array<IrisSlotRef | undefined>): () => void {
  const cleanups = refs.filter(Boolean).map((ref) => attachRef(node, ref))
  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}

function createRefAttachment(
  childProps: Record<string | symbol, unknown>,
  refs: Array<IrisSlotRef | undefined>,
): void {
  if (!refs.some(Boolean)) return
  const attachmentKey = createAttachmentKey()
  childProps[attachmentKey] = ((node: HTMLElement) =>
    attachRefs(node, refs)) satisfies Attachment<HTMLElement>
}

function mergeChildProps(
  parentProps: SlotProps,
  childProps: Record<string, unknown>,
  parentRef?: IrisSlotRef,
  childRef?: IrisSlotRef,
): IrisSlotMergedProps {
  // Core owns the decision table; `preserveRef` leaves `ref` to this adapter.
  const merged = mergeSlotProps(parentProps, childProps, { preserveRef: true }) as Record<
    string | symbol,
    unknown
  >

  createRefAttachment(merged, [parentRef, (childProps.ref as IrisSlotRef | undefined) ?? childRef])
  return merged as IrisSlotMergedProps
}
