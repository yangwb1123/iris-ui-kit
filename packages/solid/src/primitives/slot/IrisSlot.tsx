import {
  attributeNameFromProp,
  composeEventHandlers,
  isEventProp,
  mergeClassValues,
  mergeStyleValues,
  patchOpeningTag,
  type SlotProps,
} from '@iris-ui-kit/core'
import { splitProps, type JSX } from 'solid-js'
import { spread } from 'solid-js/web'

type AnyProps = Record<string, unknown>
type ElementWithDelegatedEvents = Element & Record<`$$${string}`, unknown>
type SolidSsrNode = { t: string }

export interface IrisSlotProps {
  children?: JSX.Element
  ref?: HTMLElement | ((element: HTMLElement) => void)
  [key: string]: unknown
}

function eventNameFromProp(key: string): string {
  return key.slice(2).toLowerCase()
}

function normalizeEventHandler(value: unknown): ((event: Event) => void) | undefined {
  if (typeof value === 'function') return value as (event: Event) => void
  if (Array.isArray(value) && typeof value[0] === 'function') {
    const handler = value[0] as (data: unknown, event: Event) => void
    return (event: Event) => handler(value[1], event)
  }
  return undefined
}

function resolveSingleSsrNode(value: unknown): SolidSsrNode | null {
  const candidates: SolidSsrNode[] = []
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item)
      return
    }
    if (
      candidate != null &&
      typeof candidate === 'object' &&
      typeof (candidate as { t?: unknown }).t === 'string'
    ) {
      candidates.push(candidate as SolidSsrNode)
    }
  }
  visit(value)
  return candidates.length === 1 ? candidates[0] : null
}

/**
 * Merge a primitive's props into an already-serialised SSR element.
 *
 * Solid emits the child as a string during SSR, so there is no element to
 * spread onto. Core owns the merge (attribute naming, boolean serialisation,
 * escaping, class/style order); this only re-hosts it into the SSR node shape.
 */
function mergeSsrSlotProps(child: SolidSsrNode, slotProps: SlotProps): SolidSsrNode {
  const openEnd = child.t.indexOf('>')
  if (openEnd < 0) return child
  return {
    ...child,
    t: patchOpeningTag(child.t.slice(0, openEnd + 1), slotProps) + child.t.slice(openEnd + 1),
  }
}

function resolveSingleElement(value: JSX.Element): Element | null {
  const candidates: Element[] = []

  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item)
      return
    }
    if (typeof Element !== 'undefined' && candidate instanceof Element) candidates.push(candidate)
  }

  visit(value)
  if (candidates.length !== 1) {
    console.warn(`[iris-ui] IrisSlot expected exactly one child element; got ${candidates.length}.`)
    return null
  }
  return candidates[0]
}

/**
 * Merge Slot props onto the already-created Solid DOM element. Solid has no
 * virtual element to clone, so the child DOM node itself is returned after
 * `solid-js/web` applies a reactive prop proxy:
 *
 * - parent and child handlers compose, parent first;
 * - class names concatenate, parent first;
 * - styles merge with child declarations last;
 * - child attributes win on conflicts;
 * - the Slot ref is invoked in addition to the child's already-run JSX ref.
 */
export function IrisSlot(props: IrisSlotProps): JSX.Element {
  const [local, slotProps] = splitProps(props, ['children'])
  const childValue = local.children

  // During Solid SSR the child is serialized rather than represented by a DOM
  // node. Returning it unchanged preserves the wrapper-free tree; client
  // hydration applies the merged props to that same element.
  if (typeof Element === 'undefined') {
    const child = resolveSingleSsrNode(childValue)
    return (child ? mergeSsrSlotProps(child, slotProps as AnyProps) : childValue) as JSX.Element
  }

  const child = resolveSingleElement(childValue)
  if (!child) return null as unknown as JSX.Element

  const childClass = child.getAttribute('class') ?? ''
  const childStyle = child.getAttribute('style') ?? ''
  const childAttributes = new Set(Array.from(child.attributes, ({ name }) => name))
  const childEvents = new Map<string, unknown>()
  const eventHost = child as ElementWithDelegatedEvents

  for (const key of Object.keys(slotProps)) {
    if (isEventProp(key)) {
      childEvents.set(key, eventHost[`$$${eventNameFromProp(key)}`])
    }
  }

  const merged: AnyProps = {}
  for (const key of Object.keys(slotProps)) {
    if (
      !isEventProp(key) &&
      key !== 'ref' &&
      key !== 'class' &&
      key !== 'className' &&
      key !== 'style' &&
      childAttributes.has(attributeNameFromProp(key))
    ) {
      continue
    }

    Object.defineProperty(merged, key, {
      enumerable: true,
      get() {
        const parentValue = (slotProps as AnyProps)[key]
        const childValueForKey = childEvents.get(key)
        const parentHandler = normalizeEventHandler(parentValue)
        const childHandler = normalizeEventHandler(childValueForKey)

        if (isEventProp(key) && parentHandler && childHandler) {
          return composeEventHandlers(parentHandler, childHandler)
        }
        if (key === 'class' || key === 'className') {
          return mergeClassValues(parentValue, childClass)
        }
        if (key === 'style') return mergeStyleValues(parentValue, childStyle)
        return parentValue
      },
    })
  }

  spread(child, merged, child.namespaceURI === 'http://www.w3.org/2000/svg', true)
  return child as JSX.Element
}
