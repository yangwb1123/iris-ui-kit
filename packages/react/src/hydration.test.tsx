// @vitest-environment jsdom
//
// REAL hydration harness (ROADMAP v3 #8). Where `ssr.test.tsx` proves that
// components render to a *string* on the server, this file proves the half the
// server pass cannot: that the client can `hydrateRoot` that exact string
// WITHOUT a mismatch. A hydration mismatch is the canonical production SSR bug
// — server HTML ≠ client first render — and React only ever surfaces it as a
// `console.error` warning ("did not match" / "Hydration failed"), never a
// throw. So this test actually *spies on console.error* and fails if React
// would have warned. renderToString here (not renderToStaticMarkup) keeps the
// `data-reactroot`-style hydration markers React needs to match against.
//
// SUBSET: the SSR-safe, non-portal cases mirrored from ssr.test.tsx. Portal /
// overlay components (Dialog, Popover, Tooltip, Menu, …) mount nothing on the
// server (their content lives behind a closed trigger / a portal that no-ops
// without a DOM), so there is no server HTML to hydrate against — they are out
// of scope by construction, not excluded due to a bug.
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act, cleanup } from '@testing-library/react'

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
 * Each case is a *factory* so the server tree and the client tree are distinct
 * element instances built from identical inputs — exactly how SSR works in
 * production (the server process and the browser process each construct the
 * tree independently). A shared element reference could mask an id/random drift
 * that real two-process hydration would hit.
 */
const cases: Array<{ name: string; render: () => React.ReactElement }> = [
  { name: 'IrisButton', render: () => <IrisButton>Save</IrisButton> },
  { name: 'IrisBadge', render: () => <IrisBadge>New</IrisBadge> },
  { name: 'IrisChip', render: () => <IrisChip>Tag</IrisChip> },
  { name: 'IrisKbd', render: () => <IrisKbd>Esc</IrisKbd> },
  { name: 'IrisDivider', render: () => <IrisDivider /> },
  { name: 'IrisAlert', render: () => <IrisAlert>Heads up</IrisAlert> },
  { name: 'IrisCard', render: () => <IrisCard>Body</IrisCard> },
  { name: 'IrisSpinner', render: () => <IrisSpinner /> },
  { name: 'IrisInput', render: () => <IrisInput value="" onChange={() => {}} /> },
  { name: 'IrisTextarea', render: () => <IrisTextarea value="" onChange={() => {}} /> },
  { name: 'IrisCheckbox', render: () => <IrisCheckbox checked={false} onChange={() => {}} /> },
  { name: 'IrisSwitch', render: () => <IrisSwitch checked={false} onChange={() => {}} /> },
  {
    name: 'IrisPasswordInput',
    render: () => <IrisPasswordInput value="" onChange={() => {}} />,
  },
  {
    name: 'IrisFormField',
    render: () => (
      <IrisFormField label="Email" hint="We never share it.">
        <IrisInput value="" onChange={() => {}} />
      </IrisFormField>
    ),
  },
  {
    name: 'IrisAccordion',
    render: () => (
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
    render: () => (
      <IrisRadioGroup value="x" onChange={() => {}}>
        <IrisRadio value="x">X</IrisRadio>
        <IrisRadio value="y">Y</IrisRadio>
      </IrisRadioGroup>
    ),
  },
]

/** React phrases every hydration-mismatch warning with one of these markers. */
const MISMATCH_MARKERS = [
  'did not match',
  'Hydration failed',
  'hydrating',
  'server HTML',
  'tree mismatch',
  'Expected server HTML',
  'A tree hydrated but some attributes',
]

function isHydrationWarning(args: unknown[]): boolean {
  const text = args
    .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : ''))
    .join(' ')
  return MISMATCH_MARKERS.some((m) => text.includes(m))
}

/**
 * Canonical, serializer-agnostic snapshot of a DOM subtree: tag + sorted
 * attributes + recursively its children, with text content folded in. We can't
 * string-compare `renderToString` output against `container.innerHTML` because
 * jsdom's serializer legitimately differs from React's on things that are NOT
 * hydration changes — void elements (`<input/>` vs `<input>`) and attribute
 * order (a reflected `checked` property lands in a different slot). This canon
 * still catches a real mismatch repair (changed attribute value, dropped/added
 * node, rewritten text) while ignoring those cosmetic serialization gaps.
 */
function canon(node: Node): string {
  if (node.nodeType === 3 /* text */) return JSON.stringify(node.nodeValue ?? '')
  if (node.nodeType !== 1 /* element */) return ''
  const el = node as Element
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}=${JSON.stringify(a.value)}`)
    .sort()
    .join(' ')
  const kids = Array.from(el.childNodes).map(canon).join('')
  return `<${el.tagName.toLowerCase()} ${attrs}>${kids}</${el.tagName.toLowerCase()}>`
}

afterEach(cleanup)

describe('@iris-ui/react hydration', () => {
  it('runs in a real DOM (jsdom) environment', () => {
    // hydrateRoot needs a live `document`; if this regressed to the node env the
    // whole file would be vacuously green.
    expect(typeof document).not.toBe('undefined')
    expect(typeof window).not.toBe('undefined')
  })

  describe('server HTML hydrates with no mismatch warning', () => {
    for (const { name, render } of cases) {
      it(name, async () => {
        // 1. Server render (renderToString keeps hydration markers).
        const serverHtml = renderToString(render())

        // 2. Plant that HTML into a real container, just like the browser
        //    receives it in the initial document. Snapshot its canonical
        //    structure NOW (pre-hydration) so we can prove hydration didn't
        //    mutate the live DOM — comparing live-DOM to live-DOM avoids any
        //    server-string vs jsdom serializer skew.
        const container = document.createElement('div')
        container.innerHTML = serverHtml
        document.body.appendChild(container)
        const preHydrationCanon = Array.from(container.childNodes).map(canon).join('')

        // 3. Hydrate. Spy on console.error across the whole hydrate commit so a
        //    mismatch (which React only *warns* about) is caught.
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        let root: ReturnType<typeof hydrateRoot> | undefined
        try {
          await act(async () => {
            root = hydrateRoot(container, render())
          })

          // 4a. No hydration-mismatch warning fired.
          const hydrationWarnings = errorSpy.mock.calls.filter((call) => isHydrationWarning(call))
          expect(
            hydrationWarnings,
            `hydration mismatch for ${name}:\n${hydrationWarnings
              .map((c) => c.join(' '))
              .join('\n')}`,
          ).toEqual([])

          // 4b. The DOM is stable: React did not rewrite the server markup
          //     during hydration (a mismatch repair would mutate the tree).
          //     Compare the live container's canonical structure before vs
          //     after hydration so cosmetic serializer differences can't
          //     trip it, but a genuine structural rewrite still would.
          const postHydrationCanon = Array.from(container.childNodes).map(canon).join('')
          expect(postHydrationCanon).toBe(preHydrationCanon)
        } finally {
          errorSpy.mockRestore()
          if (root) {
            await act(async () => {
              root!.unmount()
            })
          }
          container.remove()
        }
      })
    }
  })
})
