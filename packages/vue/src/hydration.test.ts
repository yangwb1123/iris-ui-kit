// Real SSR + hydration test (ROADMAP v3 R8, Vue side).
//
// The sibling `ssr.test.ts` only proves components render to a *string* in a
// no-DOM environment. That does NOT catch the production failure mode that
// actually breaks SSR apps (Nuxt et al): a **hydration mismatch**, where the
// server HTML differs from the client's first render, so Vue tears down the
// SSR markup and re-renders from scratch (losing event listeners, flashing the
// UI, and logging warnings).
//
// This test runs in jsdom and performs the *full* cycle for each case:
//   1. server-render the component with `renderToString` from
//      '@vue/server-renderer' (createSSRApp → renderToString),
//   2. drop that HTML into a real container element,
//   3. hydrate by mounting a *fresh* SSR app onto the existing markup
//      (`createSSRApp(...).mount(container)` — Vue hydrates, it does not
//      replace, when it finds server markup),
//   4. assert Vue reported NO hydration mismatch.
//
// How Vue 3.5 signals a mismatch (verified against the bundled runtime):
//   • per-node warnings via `console.warn(...)` — e.g.
//     "Hydration text mismatch in", "Hydration children mismatch on",
//     "Hydration node mismatch", "Hydration attribute mismatch on";
//   • a one-shot summary via `console.error("Hydration completed but contains
//     mismatches.")`.
//   The summary is guarded by a *module-global* flag (`hasLoggedMismatchError`)
//   so it only ever fires once per process — therefore the reliable, per-case
//   signal is the `console.warn` path, which we spy on and assert against.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, type VNode } from 'vue'
import { renderToString } from '@vue/server-renderer'

import {
  IrisButton,
  IrisBadge,
  IrisChip,
  IrisKbd,
  IrisDivider,
  IrisAlert,
  IrisCard,
  IrisSpinner,
  IrisInput,
  IrisTextarea,
  IrisCheckbox,
  IrisSwitch,
  IrisPasswordInput,
  IrisFormField,
  IrisAccordion,
  IrisAccordionItem,
  IrisRadioGroup,
  IrisRadio,
} from './index'

/**
 * SSR-safe subset only: simple, non-overlay components that render their full
 * markup inline. Portal/overlay components (Dialog, Drawer, Popover, Tooltip,
 * Menu, Dropdown, Toast, …) are deliberately excluded — in their default
 * *closed* state they teleport nothing to SSR, so there's nothing meaningful to
 * hydrate, and `<Teleport>` hydration needs a live target that doesn't exist in
 * isolated string output.
 *
 * Each factory builds the component standalone in its default / closed state,
 * exactly as `ssr.test.ts` does, so the two tests stay in lock-step.
 */
const cases: Array<{ name: string; factory: () => VNode }> = [
  { name: 'IrisButton', factory: () => h(IrisButton, null, { default: () => 'Save' }) },
  { name: 'IrisBadge', factory: () => h(IrisBadge, null, { default: () => 'New' }) },
  { name: 'IrisChip', factory: () => h(IrisChip, null, { default: () => 'Tag' }) },
  { name: 'IrisKbd', factory: () => h(IrisKbd, null, { default: () => 'Esc' }) },
  { name: 'IrisDivider', factory: () => h(IrisDivider) },
  { name: 'IrisAlert', factory: () => h(IrisAlert, null, { default: () => 'Heads up' }) },
  { name: 'IrisCard', factory: () => h(IrisCard, null, { default: () => 'Body' }) },
  { name: 'IrisSpinner', factory: () => h(IrisSpinner) },
  { name: 'IrisInput', factory: () => h(IrisInput, { modelValue: '' }) },
  { name: 'IrisTextarea', factory: () => h(IrisTextarea, { modelValue: '' }) },
  { name: 'IrisCheckbox', factory: () => h(IrisCheckbox, { modelValue: false }) },
  { name: 'IrisSwitch', factory: () => h(IrisSwitch, { modelValue: false }) },
  { name: 'IrisPasswordInput', factory: () => h(IrisPasswordInput, { modelValue: '' }) },
  {
    name: 'IrisFormField',
    factory: () =>
      h(
        IrisFormField,
        { label: 'Email', hint: 'We never share it.' },
        { default: () => h(IrisInput, { modelValue: '' }) },
      ),
  },
  {
    name: 'IrisAccordion',
    factory: () =>
      h(IrisAccordion, null, {
        default: () => [
          h(IrisAccordionItem, { value: 'a', title: 'A' }, { default: () => 'Panel A' }),
          h(IrisAccordionItem, { value: 'b', title: 'B' }, { default: () => 'Panel B' }),
        ],
      }),
  },
  {
    name: 'IrisRadioGroup',
    factory: () =>
      h(
        IrisRadioGroup,
        { modelValue: 'x' },
        {
          default: () => [
            h(IrisRadio, { value: 'x' }, { default: () => 'X' }),
            h(IrisRadio, { value: 'y' }, { default: () => 'Y' }),
          ],
        },
      ),
  },
]

/** True if a console call looks like a Vue hydration-mismatch report. */
function isHydrationMismatch(args: unknown[]): boolean {
  return args.some((a) => typeof a === 'string' && /hydration/i.test(a) && /mismatch/i.test(a))
}

/**
 * Round-trip an HTML string through jsdom's parser+serializer so two strings
 * are compared under the *same* serializer. `@vue/server-renderer` emits empty
 * attributes bare (`data-x`) while jsdom serializes them as `data-x=""`; that
 * cosmetic difference is NOT a hydration mismatch, so normalizing both sides
 * isolates the thing we actually care about — did hydration adopt the markup
 * in place, or silently rewrite the subtree?
 */
function normalizeHtml(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.innerHTML
}

describe('@iris-ui/vue SSR hydration', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Capture (and silence) Vue's mismatch reporting so we can assert on it.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('runs in a DOM (jsdom) environment', () => {
    expect(typeof document).toBe('object')
    expect(typeof window).toBe('object')
  })

  describe('server markup hydrates without a mismatch', () => {
    for (const { name, factory } of cases) {
      it(name, async () => {
        // 1. Server render → HTML string (no DOM access on this pass).
        const ssrHtml = await renderToString(createSSRApp({ render: factory }))
        expect(ssrHtml.length).toBeGreaterThan(0)

        // 2. Plant the server HTML into a real container, like a server
        //    response's `<div id="app">…</div>` arriving in the browser.
        const container = document.createElement('div')
        container.innerHTML = ssrHtml
        document.body.appendChild(container)

        // 3. Hydrate: a fresh SSR app mounts ONTO the existing markup. Vue
        //    walks the server DOM and adopts it rather than re-creating it —
        //    *unless* it finds a mismatch.
        const app = createSSRApp({ render: factory })
        let mountedEl: HTMLElement
        try {
          app.mount(container)
          mountedEl = container

          // 4a. No hydration-mismatch report from either channel.
          const offending = [...errorSpy.mock.calls, ...warnSpy.mock.calls].filter(
            isHydrationMismatch,
          )
          expect(
            offending,
            `hydration mismatch for ${name}:\n${offending.map((c) => c.join(' ')).join('\n')}`,
          ).toHaveLength(0)

          // 4b. Hydration adopted the markup in place: the post-hydration HTML
          //     equals what the server produced (compared under one serializer
          //     via `normalizeHtml`). A mismatch that slipped past the warning
          //     channel would rewrite the subtree and diverge here.
          expect(mountedEl.innerHTML).toBe(normalizeHtml(ssrHtml))
        } finally {
          app.unmount()
          container.remove()
        }
      })
    }
  })
})
