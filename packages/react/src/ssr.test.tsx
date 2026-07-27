// @vitest-environment node
//
// Server-side rendering smoke harness (ROADMAP #1). This file deliberately
// runs in the *node* environment — there is NO `document`, `window`, or any
// DOM global — so it simulates a real server render (Next.js RSC / SSR pass).
//
// What it proves:
//   1. Components have ZERO render-time DOM access — they render to a string
//      without throwing. (Stylesheet injection and scroll-lock are correctly
//      deferred to effects, which `renderToStaticMarkup` never runs.)
//   2. Generated element ids are deterministic across renders — the precise
//      regression guard for the old module-level counter (`generateId`) that
//      drifted between server and client and broke hydration + ARIA links.
//      Both adapters now use the framework-native `useId`.
//   3. ARIA associations (`for` / `aria-describedby`) survive SSR with matching
//      ids, so screen-reader wiring is intact before hydration.
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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
 * Each entry renders standalone (no required external composition) in its
 * default / closed state, so portal-based overlays never mount during SSR.
 */
const cases: Array<{ name: string; element: React.ReactElement }> = [
  { name: 'IrisButton', element: <IrisButton>Save</IrisButton> },
  { name: 'IrisBadge', element: <IrisBadge>New</IrisBadge> },
  { name: 'IrisChip', element: <IrisChip>Tag</IrisChip> },
  { name: 'IrisKbd', element: <IrisKbd>Esc</IrisKbd> },
  { name: 'IrisDivider', element: <IrisDivider /> },
  { name: 'IrisAlert', element: <IrisAlert>Heads up</IrisAlert> },
  { name: 'IrisCard', element: <IrisCard>Body</IrisCard> },
  { name: 'IrisSpinner', element: <IrisSpinner /> },
  { name: 'IrisInput', element: <IrisInput value="" onChange={() => {}} /> },
  { name: 'IrisTextarea', element: <IrisTextarea value="" onChange={() => {}} /> },
  { name: 'IrisCheckbox', element: <IrisCheckbox checked={false} onChange={() => {}} /> },
  { name: 'IrisSwitch', element: <IrisSwitch checked={false} onChange={() => {}} /> },
  { name: 'IrisPasswordInput', element: <IrisPasswordInput value="" onChange={() => {}} /> },
  {
    name: 'IrisFormField',
    element: (
      <IrisFormField label="Email" hint="We never share it.">
        <IrisInput value="" onChange={() => {}} />
      </IrisFormField>
    ),
  },
  {
    name: 'IrisAccordion',
    element: (
      <IrisAccordion>
        <IrisAccordionItem value="a" title="A">
          Panel A
        </IrisAccordionItem>
        <IrisAccordionItem value="b" title="B">
          Panel B
        </IrisAccordionItem>
      </IrisAccordion>
    ),
  },
  {
    name: 'IrisRadioGroup',
    element: (
      <IrisRadioGroup value="x" onChange={() => {}}>
        <IrisRadio value="x">X</IrisRadio>
        <IrisRadio value="y">Y</IrisRadio>
      </IrisRadioGroup>
    ),
  },
]

describe('@iris-ui-kit/react SSR', () => {
  it('runs in a no-DOM (server) environment', () => {
    // If this fails, the harness silently regressed to jsdom and the rest of
    // the file no longer proves anything about server safety.
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  describe('renders to static markup without touching the DOM', () => {
    for (const { name, element } of cases) {
      it(name, () => {
        let html = ''
        expect(() => {
          html = renderToStaticMarkup(element)
        }).not.toThrow()
        expect(html.length).toBeGreaterThan(0)
        // The component body actually executed (not an empty shell).
        expect(html).toContain('data-iris-')
      })
    }
  })

  it('produces deterministic ids across repeated renders (no counter drift)', () => {
    // The old `generateId` module counter emitted `…-1` then `…-2` on a second
    // render, diverging server vs client markup. `useId` restarts per render,
    // so two identical trees must yield byte-identical markup.
    const tree = (
      <IrisFormField label="Email" hint="Required">
        <IrisInput value="" onChange={() => {}} />
      </IrisFormField>
    )
    const first = renderToStaticMarkup(tree)
    const second = renderToStaticMarkup(tree)
    expect(second).toBe(first)
  })

  it('keeps ARIA associations wired in server output', () => {
    const html = renderToStaticMarkup(
      <IrisFormField label="Email" hint="We never share it.">
        <IrisInput value="" onChange={() => {}} />
      </IrisFormField>,
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
