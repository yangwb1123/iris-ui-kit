/**
 * Framework-agnostic `asChild` (Slot) merge semantics.
 *
 * ## Why this lives in core
 *
 * `asChild` is the project's primary composition pattern: a primitive hands its
 * contract to the consumer's own element instead of emitting a wrapper. Four
 * adapters each implemented the merge independently, which meant the documented
 * contract ("parent class/style merged first, child value wins on conflict,
 * parent handler first and able to `preventDefault`") was re-derived four times
 * and could silently drift between frameworks.
 *
 * This module owns the *decision table* — which key wins, how class/style
 * combine, how handlers compose, and how a prop maps onto a DOM attribute.
 * Adapters keep only what is genuinely framework-specific: resolving the child
 * element, plumbing refs, and handing the merged record to their renderer
 * (`cloneElement` / `h` / `spread` / an attachment).
 *
 * Nothing here imports a framework — core must stay framework-free.
 */

import { composeEventHandlers } from './utils'

/** Any prop bag. Deliberately loose: adapters pass their own shapes through. */
export type SlotProps = Record<string, unknown>

/**
 * Standard DOM event names, used to validate Svelte's lowercase handler
 * convention (`onclick`). Without this, any prop merely *starting* with "on"
 * (`once`, `only`, `one`) would be misread as a handler.
 *
 * Stored as one space-separated string rather than 110 quoted literals: the
 * published adapters inline this module, so the compact form is worth the
 * `split` at module init.
 */
const DOM_EVENT_NAMES: ReadonlySet<string> = new Set(
  (
    'abort afterprint animationcancel animationend animationiteration animationstart auxclick ' +
    'beforeinput beforeprint beforeunload blur canplay canplaythrough change click close ' +
    'compositionend compositionstart compositionupdate contextmenu copy cuechange cut dblclick ' +
    'drag dragend dragenter dragexit dragleave dragover dragstart drop durationchange emptied ' +
    'ended error focus focusin focusout formdata fullscreenchange fullscreenerror ' +
    'gotpointercapture hashchange input invalid keydown keypress keyup languagechange load ' +
    'loadeddata loadedmetadata loadstart lostpointercapture message messageerror mousedown ' +
    'mouseenter mouseleave mousemove mouseout mouseover mouseup offline online pagehide ' +
    'pageshow paste pause play playing pointercancel pointerdown pointerenter pointerleave ' +
    'pointermove pointerout pointerover pointerup popstate progress ratechange reset resize ' +
    'scroll scrollend securitypolicyviolation seeked seeking select selectionchange selectstart ' +
    'slotchange stalled storage submit suspend timeupdate toggle touchcancel touchend touchmove ' +
    'touchstart transitioncancel transitionend transitionrun transitionstart ' +
    'unhandledrejection unload volumechange waiting wheel'
  ).split(' '),
)

/**
 * Is this key an event handler?
 *
 * Accepts both conventions on purpose: React/Vue/Solid use `onClick`, while
 * Svelte 5 spells DOM events lowercase (`onclick`) and its own callbacks keep
 * the capitalised form. The lowercase form is validated against the known DOM
 * event names so unrelated props that happen to start with "on" are not
 * mistaken for handlers.
 */
export function isEventProp(key: string): boolean {
  if (/^on[A-Z]/.test(key)) return true
  if (!/^on[a-z]/.test(key)) return false
  return DOM_EVENT_NAMES.has(key.slice(2))
}

/** DOM event name for a handler prop: `onClick` → `click`, `onkeydown` → `keydown`. */
export function eventNameFromProp(key: string): string {
  return key
    .slice(2)
    .replace(/capture$/i, '')
    .toLowerCase()
}

/**
 * The prop key an adapter uses for CSS classes. React and Solid's JSX use
 * `className` on components while the DOM uses `class`; Vue/Svelte use `class`.
 */
export type SlotClassKey = 'class' | 'className'

/** Split a class value into tokens, accepting a string or an array. */
function classTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => classTokens(entry))
  }
  if (typeof value !== 'string') return []
  return value.trim().split(/\s+/).filter(Boolean)
}

/**
 * Combine parent and child class values.
 *
 * Parent tokens come first so the child's own class stays last in the cascade,
 * and duplicates are dropped so re-merging the same pair is idempotent. Dropping
 * a repeated identical token cannot change meaning — the class list is a set for
 * styling purposes — so this is safe to apply uniformly.
 */
export function mergeClassValues(parent: unknown, child: unknown): string | undefined {
  const parentTokens = classTokens(parent)
  const childTokens = classTokens(child)
  const merged = [...parentTokens, ...childTokens.filter((token) => !parentTokens.includes(token))]
  return merged.join(' ') || undefined
}

/** Render a style value as CSS text, accepting a string or an object map. */
export function styleText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry != null)
    .map(([name, entry]) => `${name}: ${String(entry)}`)
    .join('; ')
}

/**
 * Combine parent and child style values.
 *
 * Parent declarations first, child last, so the child wins on conflicts —
 * matching the class rule. String and object inputs are both accepted and both
 * normalise to CSS text, which is what every adapter ultimately needs (React and
 * Vue spread an object map; Solid and Svelte assign text to the element).
 */
export function mergeStyleValues(parent: unknown, child: unknown): string | undefined {
  const parentCss = styleText(parent).trim().replace(/;+$/, '')
  const childCss = styleText(child).trim().replace(/;+$/, '')
  if (!parentCss) return childCss || undefined
  if (!childCss) return parentCss || undefined
  // Later declarations win in the cascade, so a repeated property can be
  // collapsed to its final value instead of emitting `color: red; color: blue`.
  const merged = new Map(parseCssDeclarations(parentCss))
  for (const [name, value] of parseCssDeclarations(childCss)) merged.set(name, value)
  return [...merged].map(([name, value]) => `${name}: ${value}`).join('; ')
}

/** Options controlling the few genuinely framework-specific shapes. */
export interface MergeSlotPropsOptions {
  /** Prop key the framework uses for classes. Default `'class'`. */
  classKey?: SlotClassKey
  /**
   * Emit `style` as an object map instead of CSS text. React and Vue assign a
   * style object to the element; Solid and Svelte assign text. Default `false`
   * (CSS text), which is the common denominator.
   */
  styleAsObject?: boolean
  /**
   * Merge `ref` by composing both refs into one, instead of letting one win.
   * Refs differ per framework (React callback/mutable objects, Vue `Ref.value`,
   * Svelte attachments), so composition is left to the adapter; core simply
   * declines to touch `ref` and lets the adapter finish the job.
   */
  preserveRef?: boolean
}

/**
 * Merge a primitive's (parent) props onto a consumer's (child) props.
 *
 * The contract, identical for every adapter:
 *
 * - **event handlers** — composed, parent first, and a parent
 *   `preventDefault()` skips the child. Lets the primitive intercept (e.g. an
 *   open state that a disabled button must not change).
 * - **`class`** — parent tokens first, child last, duplicates dropped.
 * - **`style`** — parent declarations first, child last.
 * - **everything else** — the child's explicit value wins, including an explicit
 *   `undefined`; a parent-only key is passed through.
 */
export function mergeSlotProps(
  parent: SlotProps,
  child: SlotProps,
  options: MergeSlotPropsOptions = {},
): SlotProps {
  const { classKey = 'class', styleAsObject = false, preserveRef = false } = options
  const merged: SlotProps = {}

  for (const [key, value] of Object.entries(parent)) {
    if (key === 'ref' && preserveRef) continue
    merged[key] = value
  }

  for (const [key, childValue] of Object.entries(child)) {
    if (key === 'ref' && preserveRef) continue
    const parentValue = parent[key]

    if (isEventProp(key) && typeof parentValue === 'function' && typeof childValue === 'function') {
      merged[key] = composeEventHandlers(
        parentValue as (event: { defaultPrevented: boolean }) => void,
        childValue as (event: { defaultPrevented: boolean }) => void,
      )
    } else if (key === classKey) {
      const combined = mergeClassValues(parentValue, childValue)
      if (combined !== undefined) merged[key] = combined
    } else if (key === 'style') {
      const combined = mergeStyleValues(parentValue, childValue)
      if (combined === undefined) continue
      merged[key] = styleAsObject ? cssTextToStyleObject(combined) : combined
    } else {
      // An explicit child value is authoritative, including `undefined`.
      merged[key] = childValue
    }
  }

  // A parent class/style with no child counterpart still has to land, and it
  // must survive SSR as a real attribute rather than only a client-side merge.
  if (!(classKey in child) && classKey in parent) {
    const combined = mergeClassValues(parent[classKey], undefined)
    if (combined !== undefined) merged[classKey] = combined
  }
  if (!('style' in child) && 'style' in parent) {
    const combined = mergeStyleValues(parent.style, undefined)
    if (combined !== undefined) {
      merged.style = styleAsObject ? cssTextToStyleObject(combined) : combined
    }
  }

  return merged
}

/** Parse CSS text back into an object map (for the style-object adapters). */
export function cssTextToStyleObject(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const declaration of css.split(';')) {
    const index = declaration.indexOf(':')
    if (index < 0) continue
    const name = declaration.slice(0, index).trim()
    const value = declaration.slice(index + 1).trim()
    if (name) out[name] = value
  }
  return out
}

/**
 * Apply parent declarations onto an existing CSS text without overwriting the
 * child. Used by the attachments (Solid/Svelte) that patch a live element
 * instead of re-rendering it, where "child wins" means "already set, leave it".
 */
export function mergeStyleIntoCssText(cssTextValue: unknown, existing: string): string {
  const source = styleText(cssTextValue)
  if (!source) return existing
  const probe = parseCssDeclarations(source)
  const current = parseCssDeclarations(existing)
  const out = [...current]
  for (const [name, value] of probe) {
    const at = out.findIndex(([entry]) => entry === name)
    if (at >= 0) out[at] = [name, value]
    else out.push([name, value])
  }
  return out
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ')
    .replace(/;\s*$/, '')
}

/** Parse `a: b; c: d` into ordered `[name, value]` pairs. */
export function parseCssDeclarations(css: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const declaration of css.split(';')) {
    const index = declaration.indexOf(':')
    if (index < 0) continue
    const name = declaration.slice(0, index).trim()
    const value = declaration.slice(index + 1).trim()
    if (name) out.push([name, value])
  }
  return out
}

/**
 * The tiny slice of the DOM these helpers need.
 *
 * Core is compiled without `lib.dom` (see `packages/core/tsconfig.json`), so the
 * live-element helpers describe their target structurally instead of widening
 * core's global type environment. That also keeps them usable from any host.
 */
export interface SlotClassTarget {
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
}

/** The subset of `CSSStyleDeclaration` the style helper relies on. */
export interface SlotStyleTarget {
  style: {
    getPropertyValue(name: string): string
    setProperty(name: string, value: string): void
  }
}

/** Apply parent tokens to a live element's class list without duplicates. */
export function mergeClassIntoElement(element: SlotClassTarget, parentClass: unknown): void {
  const merged = mergeClassValues(parentClass, element.getAttribute('class') ?? '')
  if (merged) element.setAttribute('class', merged)
}

/** Apply parent declarations to a live element, leaving child-set names alone. */
export function mergeStyleIntoElement(element: SlotStyleTarget, parentStyle: unknown): void {
  const source = styleText(parentStyle)
  if (!source) return
  for (const [name, value] of parseCssDeclarations(source)) {
    if (!element.style.getPropertyValue(name)) {
      element.style.setProperty(name, value)
    }
  }
}

/**
 * Map a prop key onto its DOM attribute name.
 *
 * `className` → `class`, `htmlFor` → `for`, and any camelCase prop becomes
 * kebab-case (`ariaLive` → `aria-live`). An `attr:` prefix forces a verbatim
 * name, which is how an adapter overrides a prop whose derived name would be
 * wrong.
 */
export function attributeNameFromProp(key: string): string {
  if (key.startsWith('attr:')) return key.slice('attr:'.length)
  if (key === 'className') return 'class'
  if (key === 'htmlFor') return 'for'
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** HTML boolean attributes, which serialise as a bare name rather than `name=""`. */
export const BOOLEAN_ATTRIBUTES: ReadonlySet<string> = new Set([
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

/** Escape a value for use inside a double-quoted HTML attribute. */
export function escapeAttributeValue(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

/**
 * Patch an already-serialised opening tag with a primitive's props.
 *
 * Solid's SSR emits the child element as an already-serialised string, so there
 * is no VNode to clone. This performs the same merge against that string: the
 * child's own attributes are never overwritten, parent class/style are appended,
 * and boolean attributes serialise as bare names.
 *
 * `opening` must be the substring up to and including the tag's first `>`.
 */
export function patchOpeningTag(
  opening: string,
  parent: SlotProps,
  classKey: SlotClassKey = 'class',
): string {
  const openEnd = opening.indexOf('>')
  if (openEnd < 0) return opening

  let tag = opening.slice(0, openEnd)
  const existingNames = new Set<string>()
  for (const match of tag.matchAll(/\s([^\s=/>]+)(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/g)) {
    if (match[1]) existingNames.add(match[1].toLowerCase())
  }

  const additions: string[] = []
  for (const key of Object.keys(parent)) {
    if (
      key === 'children' ||
      key === 'ref' ||
      key === 'class' ||
      key === 'className' ||
      key === 'style'
    ) {
      continue
    }
    if (isEventProp(key)) continue

    const value = parent[key]
    if (value == null || typeof value === 'function') continue
    const forced = key.startsWith('attr:')
    const name = attributeNameFromProp(forced ? key.slice(4) : key)
    if (existingNames.has(name.toLowerCase())) continue

    if (!forced && BOOLEAN_ATTRIBUTES.has(name.toLowerCase())) {
      if (value) additions.push(name)
    } else {
      additions.push(`${name}="${escapeAttributeValue(value)}"`)
    }
  }

  const parentClass = mergeClassValues(parent[classKey] ?? parent.className, undefined)
  if (parentClass) {
    const classMatch = /\sclass="([^"]*)"/.exec(tag)
    if (classMatch) {
      const childClass = classMatch[1]?.trim() ?? ''
      tag = tag.replace(
        classMatch[0],
        ` class="${escapeAttributeValue(`${parentClass}${childClass ? ` ${childClass}` : ''}`)}"`,
      )
    } else {
      additions.push(`class="${escapeAttributeValue(parentClass)}"`)
    }
  }

  const parentStyle = styleText(parent.style).trim().replace(/;+$/, '')
  if (parentStyle) {
    const styleMatch = /\sstyle="([^"]*)"/.exec(tag)
    if (styleMatch) {
      const childStyle = styleMatch[1]?.trim() ?? ''
      tag = tag.replace(
        styleMatch[0],
        ` style="${escapeAttributeValue(`${parentStyle}${childStyle ? `; ${childStyle}` : ''}`)}"`,
      )
    } else {
      additions.push(`style="${escapeAttributeValue(parentStyle)}"`)
    }
  }

  // The class/style branches above may have rewritten `tag`, so this must
  // return the patched value even when there is nothing extra to append.
  return additions.length > 0
    ? `${tag} ${additions.join(' ')}${opening.slice(openEnd)}`
    : `${tag}${opening.slice(openEnd)}`
}
