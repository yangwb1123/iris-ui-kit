import { defineComponent, Fragment, h, type VNode } from 'vue'
import { mergeSlotProps as mergeCoreSlotProps, type SlotProps } from '@iris-ui-kit/core'

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
 * Merge a primitive's (parent) props onto a consumer's (child) VNode props.
 *
 * The decision table lives in `@iris-ui-kit/core` so React, Vue, Solid and
 * Svelte cannot drift: handlers compose parent-first with `preventDefault()`
 * able to skip the child, `class` concatenates parent-first, `style` merges
 * with the child last, and every other child value wins.
 *
 * Vue keeps two things of its own here — `ref` composition (a Vue `Ref` has a
 * `.value`, which core does not model) and re-exporting the name, because
 * `mergeSlotProps` is part of this module's public surface.
 */
export function mergeSlotProps(parent: SlotProps, child: SlotProps): SlotProps {
  const merged = mergeCoreSlotProps(parent, child, { styleAsObject: true, preserveRef: true })

  // Core omits `ref` entirely when `preserveRef` is set, so every case is
  // decided here. Triggers merge in two stages (attrs + trigger props, then
  // the consumer's own props), so the ref usually arrives on the *child* side.
  const parentRef = parent.ref
  const childRef = child.ref
  if (parentRef != null && childRef != null) merged.ref = composeRefs(parentRef, childRef)
  else if (parentRef != null) merged.ref = parentRef
  else if (childRef != null) merged.ref = childRef

  return merged
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
