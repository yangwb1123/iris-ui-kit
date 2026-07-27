import { createAttachmentKey, type Attachment } from 'svelte/attachments'

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

function isEventProp(key: string): boolean {
  return /^on[A-Z]/.test(key) || /^on[a-z]/.test(key)
}

function eventNameFromProp(key: string): string {
  return key
    .slice(2)
    .replace(/capture$/i, '')
    .toLowerCase()
}

function classTokens(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value.trim().split(/\s+/).filter(Boolean)
}

function mergeClassValues(parentClass: unknown, childClass: unknown): string | undefined {
  const parent = classTokens(parentClass)
  const child = classTokens(childClass)
  const merged = [...parent, ...child.filter((name) => !parent.includes(name))]
  return merged.join(' ') || undefined
}

function mergeClass(node: HTMLElement, parentClass: unknown): void {
  const merged = mergeClassValues(parentClass, node.getAttribute('class'))
  if (merged) node.className = merged
}

function styleText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return Object.entries(value as Record<string, unknown>)
    .filter(([, styleValue]) => styleValue != null)
    .map(([name, styleValue]) => `${name}: ${String(styleValue)}`)
    .join('; ')
}

function mergeStyle(node: HTMLElement, parentStyle: unknown): void {
  const cssText = styleText(parentStyle)
  if (!cssText) return

  const source = node.ownerDocument.createElement('span').style
  source.cssText = cssText
  for (let index = 0; index < source.length; index += 1) {
    const name = source.item(index)
    if (!node.style.getPropertyValue(name)) {
      node.style.setProperty(name, source.getPropertyValue(name), source.getPropertyPriority(name))
    }
  }
}

function mergeStyleValues(parentStyle: unknown, childStyle: unknown): string | undefined {
  const parentCss = styleText(parentStyle).trim().replace(/;+$/, '')
  const childCss = styleText(childStyle).trim().replace(/;+$/, '')
  if (!parentCss) return childCss || undefined
  if (!childCss) return parentCss
  return `${parentCss}; ${childCss}`
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
  parentProps: Record<string, unknown>,
  childProps: Record<string, unknown>,
  parentRef?: IrisSlotRef,
  childRef?: IrisSlotRef,
): IrisSlotMergedProps {
  const merged: Record<string | symbol, unknown> = {}

  for (const [key, value] of Object.entries(parentProps)) {
    if (key !== 'ref') merged[key] = value
  }

  for (const [key, childValue] of Object.entries(childProps)) {
    if (key === 'ref') continue
    const parentValue = parentProps[key]
    if (isEventProp(key) && typeof parentValue === 'function' && typeof childValue === 'function') {
      merged[key] = (event: Event): void => {
        ;(parentValue as (event: Event) => void)(event)
        if (!event.defaultPrevented) (childValue as (event: Event) => void)(event)
      }
    } else if (key === 'class') {
      merged[key] = mergeClassValues(parentValue, childValue)
    } else if (key === 'style') {
      merged[key] = mergeStyleValues(parentValue, childValue)
    } else {
      // Explicit child props are authoritative, including an explicit
      // `undefined`, matching ordinary Svelte spread order.
      merged[key] = childValue
    }
  }

  if (!Object.hasOwn(childProps, 'class') && Object.hasOwn(parentProps, 'class')) {
    merged.class = mergeClassValues(parentProps.class, undefined)
  }
  if (!Object.hasOwn(childProps, 'style') && Object.hasOwn(parentProps, 'style')) {
    merged.style = mergeStyleValues(parentProps.style, undefined)
  }

  createRefAttachment(merged, [parentRef, (childProps.ref as IrisSlotRef | undefined) ?? childRef])
  return merged as IrisSlotMergedProps
}

/**
 * Build the spreadable child contract used by Svelte `asChild` primitives.
 *
 * Non-event attributes remain in the object so SSR emits them. A Svelte
 * attachment performs the parts ordinary object spread cannot express:
 * class/style merging, parent-first event composition, and ref fan-out.
 * Consumers spread this object on their single element before any explicit
 * child attributes, allowing explicit child values to win.
 */
export function createSlotChildProps(
  parentProps: Record<string, unknown>,
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
    mergeClass(node, parentProps.class)
    mergeStyle(node, parentProps.style)

    const cleanups: Array<() => void> = [attachRef(node, ref)]
    for (const [key, value] of Object.entries(parentProps)) {
      if (!isEventProp(key) || typeof value !== 'function') continue
      const eventName = eventNameFromProp(key)
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
