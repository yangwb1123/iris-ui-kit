import { defineComponent, Fragment, h, type VNode } from 'vue'
import { composeEventHandlers } from '@iris-ui-kit/core'

/** Test whether a prop key looks like a Vue event listener: `onXxx`. */
function isEventListenerKey(key: string): boolean {
  return key.startsWith('on') && key.length > 2 && /[A-Z]/.test(key.charAt(2))
}

/**
 * Compose multiple Vue template refs into a single function ref. Each input
 * may be a `Ref<HTMLElement | null>`, a function ref `(el) => void`, or null.
 * All non-null inputs are invoked / assigned with the same element.
 */
export function composeRefs(...refs: Array<unknown>): (el: unknown) => void {
  return (el: unknown) => {
    for (const r of refs) {
      if (r == null) continue
      if (typeof r === 'function') {
        ;(r as (el: unknown) => void)(el)
      } else if (typeof r === 'object' && 'value' in (r as object)) {
        ;(r as { value: unknown }).value = el
      }
    }
  }
}

/**
 * Merge parent (slot) props onto a child VNode's props with Radix-style
 * semantics:
 *
 *   - **Event handlers (`on*`)**: composed via `composeEventHandlers` — the
 *     parent's handler runs first; if it calls `event.preventDefault()`, the
 *     child's handler is skipped. This lets the parent intercept (e.g. when
 *     IrisButton is `disabled`).
 *   - **`class`**: concatenated, parent first.
 *   - **`style`**: shallow-merged, child wins on key conflicts.
 *   - **Anything else**: child wins (the user's explicit prop is authoritative).
 */
export function mergeSlotProps(
  parent: Record<string, unknown>,
  child: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...child }

  for (const key in parent) {
    const parentVal = parent[key]
    const childVal = child[key]

    if (isEventListenerKey(key)) {
      if (typeof parentVal === 'function' && typeof childVal === 'function') {
        out[key] = composeEventHandlers(
          parentVal as (e: { defaultPrevented: boolean }) => void,
          childVal as (e: { defaultPrevented: boolean }) => void,
        )
      } else if (typeof parentVal === 'function' && childVal == null) {
        out[key] = parentVal
      }
      // If only child has it, child wins (already in `out`).
    } else if (key === 'ref') {
      if (parentVal != null && childVal != null) {
        out[key] = composeRefs(parentVal, childVal)
      } else if (parentVal != null) {
        out[key] = parentVal
      }
      // If only child has a ref, child wins (already in `out`).
    } else if (key === 'class') {
      const merged = [parentVal, childVal].filter(Boolean).join(' ').trim()
      if (merged) out[key] = merged
    } else if (key === 'style') {
      if (parentVal || childVal) {
        out[key] = { ...(parentVal as object | undefined), ...(childVal as object | undefined) }
      }
    } else if (!(key in child)) {
      out[key] = parentVal
    }
    // else: non-handler, present in both — child wins (already in `out`).
  }

  return out
}

/**
 * Polymorphic root helper. Renders the user's single child VNode with the
 * parent's attrs merged onto it via `mergeSlotProps`.
 *
 * Inspired by Radix UI's `<Slot>`. Used by primitives that need to render
 * "as" the user's child element instead of their own default element.
 *
 * **Limitation (intentional in this iteration)**: template `ref`s placed on
 * the slotted child are not forwarded. Use a wrapping element or wait for a
 * future iteration.
 *
 * @example
 *  <IrisSlot class="iris-button" data-iris-button-variant="solid">
 *    <RouterLink to="/save">Save</RouterLink>
 *  </IrisSlot>
 *  // → <RouterLink class="iris-button" data-iris-button-variant="solid" to="/save">Save</RouterLink>
 */
export const IrisSlot = defineComponent({
  name: 'IrisSlot',
  inheritAttrs: false,
  setup(_, { slots, attrs }) {
    return () => {
      const children = slots.default?.()
      const root = findFirstElement(children)
      if (!root) {
        if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
          console.warn('[iris-ui] IrisSlot expected exactly one child element; got none.')
        }
        return null
      }
      const merged = mergeSlotProps(
        attrs as Record<string, unknown>,
        (root.props ?? {}) as Record<string, unknown>,
      )
      return h(root.type as string, merged, root.children as unknown as VNode[])
    }
  },
})

/**
 * Walk a VNode array (which may contain Fragments / Comments / Text) and
 * return the first usable element VNode. Warns in dev if there are multiple
 * sibling roots.
 */
export function findFirstElement(children: VNode[] | undefined): VNode | null {
  if (!children || children.length === 0) return null

  let found: VNode | null = null
  let extraCount = 0

  const walk = (nodes: VNode[]) => {
    for (const node of nodes) {
      if (node.type === Fragment) {
        const fragChildren = Array.isArray(node.children) ? (node.children as VNode[]) : []
        walk(fragChildren)
        continue
      }
      if (
        typeof node.type === 'string' ||
        typeof node.type === 'object' ||
        typeof node.type === 'function'
      ) {
        if (found) {
          extraCount += 1
        } else {
          found = node
        }
      }
    }
  }
  walk(children)

  if (
    extraCount > 0 &&
    (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production')
  ) {
    console.warn(`[iris-ui] IrisSlot got ${extraCount + 1} root elements; only the first is used.`)
  }

  return found
}
