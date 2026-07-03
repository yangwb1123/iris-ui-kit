import { describe, it, expect } from 'vitest'
// @vitest-environment node
//
// Server-side rendering smoke harness (ROADMAP #1, Vue side — mirrors
// packages/react/src/ssr.test.tsx). Runs in the *node* environment with NO
// `document` / `window`, simulating a real Nuxt / `@vue/server-renderer` pass.
//
// What it proves:
//   1. Components have ZERO render-time DOM access — they render to a string
//      without throwing. (Stylesheet injection is correctly deferred to
//      onMounted, which server rendering never runs.)
//   2. `useId`-generated ids are deterministic across separate app renders —
//      the regression guard for the old module-level counter (`generateId`)
//      that drifted server vs client and broke hydration + ARIA links.
//   3. ARIA associations (`for` / `aria-describedby`) survive SSR with matching
//      ids, so screen-reader wiring is intact before hydration.
import { describe, expect, it } from 'vitest'
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

/** Render a fresh VNode tree to an SSR string in the no-DOM environment. */
function renderSSR(factory: () => VNode): Promise<string> {
  return renderToString(createSSRApp({ render: factory }))
}

/**
 * Each factory builds a component standalone (no required external
 * composition) in its default / closed state, so teleported overlays never
 * mount during SSR.
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
        {
          default: () => h(IrisInput, { modelValue: '' }),
        },
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

describe('@iris-ui/vue SSR', () => {
  it('runs in a no-DOM (server) environment', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  describe('renders to string without touching the DOM', () => {
    for (const { name, factory } of cases) {
      it(name, async () => {
        let html = ''
        await expect(
          (async () => {
            html = await renderSSR(factory)
          })(),
        ).resolves.not.toThrow()
        expect(html.length).toBeGreaterThan(0)
        // The component body actually executed (not an empty shell).
        expect(html).toContain('data-iris-')
      })
    }
  })

  it('produces deterministic ids across repeated renders (no counter drift)', async () => {
    // The old `generateId` module counter emitted `…-1` then `…-2` on a second
    // render, diverging server vs client markup. `useId` restarts per app, so
    // two fresh apps rendering identical trees must yield identical markup.
    const factory = () =>
      h(
        IrisFormField,
        { label: 'Email', hint: 'Required' },
        {
          default: () => h(IrisInput, { modelValue: '' }),
        },
      )
    const first = await renderSSR(factory)
    const second = await renderSSR(factory)
    expect(second).toBe(first)
  })

  it('keeps ARIA associations wired in server output', async () => {
    const html = await renderSSR(() =>
      h(
        IrisFormField,
        { label: 'Email', hint: 'We never share it.' },
        {
          default: () => h(IrisInput, { modelValue: '' }),
        },
      ),
    )
    // <label for="X"> must point at the control's id="X".
    const labelFor = html.match(/<label[^>]*\sfor="([^"]+)"/)?.[1]
    const inputId = html.match(/<input[^>]*\sid="([^"]+)"/)?.[1]
    expect(labelFor).toBeTruthy()
    expect(inputId).toBe(labelFor)
    // The hint is announced via aria-describedby referencing the rendered hint.
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(describedBy).toBeTruthy()
    expect(html).toContain(`id="${describedBy}"`)
  })
})
