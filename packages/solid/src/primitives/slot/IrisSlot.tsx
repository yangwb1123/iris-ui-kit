import { composeEventHandlers } from '@iris-ui-kit/core'
import { splitProps, type JSX } from 'solid-js'
import { spread } from 'solid-js/web'

type AnyProps = Record<string, unknown>
type ElementWithDelegatedEvents = Element & Record<`$$${string}`, unknown>
type SolidSsrNode = { t: string }

const BOOLEAN_ATTRIBUTES = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
])

export interface IrisSlotProps {
  children?: JSX.Element
  ref?: HTMLElement | ((element: HTMLElement) => void)
  [key: string]: unknown
}

function isEventHandlerName(key: string): boolean {
  return /^on[A-Z]/.test(key)
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

function attributeNameFromProp(key: string): string {
  if (key === 'className') return 'class'
  if (key === 'htmlFor') return 'for'
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function escapeAttribute(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function styleToString(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''

  return Object.entries(value as Record<string, unknown>)
    .filter(([, styleValue]) => styleValue != null)
    .map(([name, styleValue]) => `${name}: ${String(styleValue)}`)
    .join('; ')
}

function mergeStyles(parent: unknown, child: string): string | undefined {
  const parentCss = styleToString(parent).trim()
  const childCss = child.trim()
  if (!parentCss) return childCss || undefined
  if (!childCss) return parentCss
  return `${parentCss}; ${childCss}`
}

function mergeClasses(parent: unknown, child: string): string | undefined {
  const parentNames = typeof parent === 'string' ? parent.trim().split(/\s+/).filter(Boolean) : []
  const childNames = child.trim().split(/\s+/).filter(Boolean)
  const merged = [...parentNames, ...childNames.filter((name) => !parentNames.includes(name))]
  return merged.join(' ') || undefined
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

function mergeSsrSlotProps(child: SolidSsrNode, slotProps: AnyProps): SolidSsrNode {
  const openEnd = child.t.indexOf('>')
  if (openEnd < 0) return child

  let opening = child.t.slice(0, openEnd)
  const existingNames = new Set<string>()
  for (const match of opening.matchAll(/\s([^\s=/>]+)(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/g)) {
    if (match[1]) existingNames.add(match[1].toLowerCase())
  }

  const additions: string[] = []
  for (const key of Object.keys(slotProps)) {
    if (
      key === 'children' ||
      key === 'ref' ||
      key === 'class' ||
      key === 'className' ||
      key === 'style' ||
      isEventHandlerName(key)
    ) {
      continue
    }

    const value = slotProps[key]
    if (value == null || typeof value === 'function') continue
    const forcedAttribute = key.startsWith('attr:')
    const attributeName = attributeNameFromProp(forcedAttribute ? key.slice(5) : key)
    if (existingNames.has(attributeName.toLowerCase())) continue

    if (!forcedAttribute && BOOLEAN_ATTRIBUTES.has(attributeName.toLowerCase())) {
      if (value) additions.push(attributeName)
    } else {
      additions.push(`${attributeName}="${escapeAttribute(value)}"`)
    }
  }

  const parentClass = mergeClasses(slotProps.class ?? slotProps.className, '')
  if (parentClass) {
    const classMatch = /\sclass="([^"]*)"/.exec(opening)
    if (classMatch) {
      const childClass = classMatch[1]?.trim() ?? ''
      opening = opening.replace(
        classMatch[0],
        ` class="${escapeAttribute(parentClass)}${childClass ? ` ${childClass}` : ''}"`,
      )
    } else {
      additions.push(`class="${escapeAttribute(parentClass)}"`)
    }
  }

  const parentStyle = styleToString(slotProps.style).trim()
  if (parentStyle) {
    const styleMatch = /\sstyle="([^"]*)"/.exec(opening)
    if (styleMatch) {
      const childStyle = styleMatch[1]?.trim() ?? ''
      opening = opening.replace(
        styleMatch[0],
        ` style="${escapeAttribute(parentStyle)}${childStyle ? `; ${childStyle}` : ''}"`,
      )
    } else {
      additions.push(`style="${escapeAttribute(parentStyle)}"`)
    }
  }

  if (additions.length > 0) opening += ` ${additions.join(' ')}`
  return { ...child, t: `${opening}${child.t.slice(openEnd)}` }
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
    if (isEventHandlerName(key)) {
      childEvents.set(key, eventHost[`$$${eventNameFromProp(key)}`])
    }
  }

  const merged: AnyProps = {}
  for (const key of Object.keys(slotProps)) {
    if (
      !isEventHandlerName(key) &&
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

        if (isEventHandlerName(key) && parentHandler && childHandler) {
          return composeEventHandlers(parentHandler, childHandler)
        }
        if (key === 'class' || key === 'className') {
          return mergeClasses(parentValue, childClass)
        }
        if (key === 'style') return mergeStyles(parentValue, childStyle)
        return parentValue
      },
    })
  }

  spread(child, merged, child.namespaceURI === 'http://www.w3.org/2000/svg', true)
  return child as JSX.Element
}
