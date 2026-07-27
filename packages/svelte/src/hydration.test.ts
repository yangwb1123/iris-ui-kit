/**
 * SSR + hydration-safety test for the SSR-safe (non-overlay) component subset.
 *
 * Runs under the DEDICATED SSR config (`vitest.ssr.config.ts`):
 *   `vitest run --config vitest.ssr.config.ts` (wired into the package `test`
 *   script). It is EXCLUDED from the default `vitest.config.ts` because that
 *   config adds `@testing-library/svelte`'s `svelteTesting()`, which puts the
 *   `browser` resolve condition first and runs in jsdom — so `.svelte` files
 *   compile to the *client* (DOM) build and `svelte/server`'s `render()` cannot
 *   consume them. The production build (`svelte-package`) is NOT changed.
 *
 * --------------------------------------------------------------------------
 * WHY THIS IS AN SSR + ID-DETERMINISM SMOKE TEST, NOT A LIVE `hydrate()` TEST
 * --------------------------------------------------------------------------
 * The production failure mode this guards is a *hydration mismatch*: the client
 * hydrate fails to line up with the server-rendered markup, which silently
 * breaks event wiring and `for` / `aria-describedby` / `aria-controls`
 * relationships. To exercise a real `hydrate()` you need BOTH, in one process:
 *   1. `render` from `svelte/server` — needs the component compiled to Svelte 5's
 *      *server* output (string templates with hydration markers). Reachable only
 *      when vite-plugin-svelte compiles in the SSR module graph (node env, no
 *      `browser` condition).
 *   2. `hydrate` from `svelte` — needs the *client* (DOM) build of the same
 *      component plus a live DOM (jsdom + `browser` condition).
 * Those two are mutually exclusive within a single Vitest module graph:
 * vite-plugin-svelte v4 emits ONE compilation per `.svelte` import, decided by
 * whether the module is loaded through the SSR graph. Empirically (verified
 * while building this test): in the client/jsdom config, `render()` throws
 * "Cannot read properties of null (reading 'nodes')" because the server
 * renderer is handed a client component; in the node/SSR config there is no DOM
 * for `hydrate` to run against, and even a `?ssr`-query import still resolves
 * the client runtime via the `browser` condition. A real in-process `hydrate()`
 * onto genuine SSR markup therefore requires dual module graphs (separate SSR +
 * client transform pipelines sharing one jsdom) — brittle machinery the task
 * explicitly says to scope down from, and it cannot be done without altering
 * the build. (Same conclusion, same scoping, as `@iris-ui-kit/solid`'s
 * `hydration.test.tsx`.)
 *
 * So this test instead PROVES the hydration-breaking failure modes directly and
 * deterministically:
 *   (a) every component in the SSR-safe subset server-renders to non-empty
 *       markup carrying Svelte 5 hydration markers, with NO console.error /
 *       console.warn (an SSR-time crash is the most common invisible failure);
 *   (b) the markup is DETERMINISTIC across two independent server renders of the
 *       same tree, modulo the monotonic `generateId()` counter — if structure
 *       drifted run-to-run, a client hydrate could never match it;
 *   (c) the id wiring is INTERNALLY CONSISTENT — every `for` / `aria-describedby`
 *       / `aria-controls` / `aria-labelledby` reference in the SSR output points
 *       at an element that actually exists in that same output (a mismatch here
 *       is exactly what a hydration drift surfaces as), and sibling fields get
 *       distinct, non-colliding ids.
 *
 * NOTE on `generateId()`: `@iris-ui-kit/core`'s `generateId()` is a process-global
 * monotonic counter (`iris-1`, `iris-2`, …) that is NOT reset per render. That
 * is itself a real cross-render-drift consideration; the determinism check
 * below normalizes `iris-\d+` tokens so it asserts *structural* determinism
 * while the internal-consistency check (c) proves every generated id resolves
 * within its own render regardless of the counter's absolute value.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'svelte/server'
import type { Component } from 'svelte'

// Components that take no children render directly; ones needing children/snippets
// are wrapped in a small `src/__ssr__` harness (mirroring the repo's existing
// `*Harness.svelte` test-fixture convention).
import ButtonHarness from './__ssr__/ButtonHarness.svelte'
import ChipHarness from './__ssr__/ChipHarness.svelte'
import AlertHarness from './__ssr__/AlertHarness.svelte'
import CardHarness from './__ssr__/CardHarness.svelte'
import TwoFormFieldsHarness from './__ssr__/TwoFormFieldsHarness.svelte'
import FormFieldHarness from './primitives/form-field/FormFieldHarness.svelte'
import AccordionHarness from './primitives/accordion/AccordionHarness.svelte'

import Badge from './primitives/badge/Badge.svelte'
import IrisDivider from './primitives/divider/IrisDivider.svelte'
import IrisSpinner from './primitives/spinner/IrisSpinner.svelte'
import Input from './primitives/input/Input.svelte'
import IrisCheckbox from './primitives/checkbox/IrisCheckbox.svelte'
import Switch from './primitives/switch/Switch.svelte'

// Each case is an SSR-safe, non-overlay component (no portal / floating-ui /
// document-dependent render path). FormField + Accordion are included
// deliberately: they read `generateId()` and wire `for` / `aria-*`, so they are
// the headline drift risk.
const cases: { name: string; Comp: Component<never>; props: Record<string, unknown> }[] = [
  { name: 'Button', Comp: ButtonHarness as Component<never>, props: {} },
  { name: 'Badge', Comp: Badge as unknown as Component<never>, props: {} },
  { name: 'Chip', Comp: ChipHarness as Component<never>, props: {} },
  {
    name: 'Divider',
    Comp: IrisDivider as unknown as Component<never>,
    props: { label: 'Section' },
  },
  {
    name: 'Alert',
    Comp: AlertHarness as Component<never>,
    props: { tone: 'danger', title: 'Heads up' },
  },
  { name: 'Card', Comp: CardHarness as Component<never>, props: {} },
  { name: 'Spinner', Comp: IrisSpinner as unknown as Component<never>, props: {} },
  {
    name: 'Input',
    Comp: Input as unknown as Component<never>,
    props: { placeholder: 'Name', value: 'hi' },
  },
  { name: 'Checkbox', Comp: IrisCheckbox as unknown as Component<never>, props: { checked: true } },
  { name: 'Switch', Comp: Switch as unknown as Component<never>, props: { checked: true } },
  {
    name: 'FormField',
    Comp: FormFieldHarness as Component<never>,
    props: { label: 'Email', hint: 'We never share it.' },
  },
  {
    name: 'FormField (invalid)',
    Comp: FormFieldHarness as Component<never>,
    props: { label: 'Email', error: 'Required' },
  },
  { name: 'Accordion', Comp: AccordionHarness as Component<never>, props: {} },
]

afterEach(() => {
  vi.restoreAllMocks()
})

/** Server-renders a component under spied console.error/console.warn. */
function ssr(
  Comp: Component<never>,
  props: Record<string, unknown>,
): { body: string; head: string; errors: unknown[][]; warnings: unknown[][] } {
  const errors: unknown[][] = []
  const warnings: unknown[][] = []
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a) => {
    errors.push(a)
  })
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...a) => {
    warnings.push(a)
  })
  let body = ''
  let head = ''
  try {
    const out = render(Comp, { props } as never)
    body = out.body
    head = out.head
  } finally {
    errSpy.mockRestore()
    warnSpy.mockRestore()
  }
  return { body, head, errors, warnings }
}

/** Collect the values of an HTML attribute across all occurrences. */
function attrValues(html: string, attr: string): string[] {
  const re = new RegExp(`${attr}="([^"]*)"`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) out.push(m[1])
  return out
}

/** Does the SSR html contain an element with `id="<id>"`? */
function hasId(html: string, id: string): boolean {
  return new RegExp(`\\sid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html)
}

/** Normalize the process-global `generateId()` counter so structural
 * determinism can be compared byte-for-byte across two renders. */
function normalizeIds(html: string): string {
  return html.replace(/iris-\d+/g, 'iris-N')
}

describe('@iris-ui-kit/svelte — SSR render + hydration-safety guard (non-overlay subset)', () => {
  it('the SSR build exposes a working svelte/server render (sanity)', () => {
    const { body } = ssr(ButtonHarness as Component<never>, {})
    expect(typeof body).toBe('string')
    expect(body.length).toBeGreaterThan(0)
    // Svelte 5 SSR + hydratable output carries hydration markers (`<!--[-->`).
    expect(body).toContain('<!--[-->')
  })

  for (const c of cases) {
    it(`server-renders <${c.name}/> with no console error/warn`, () => {
      const { body, errors, warnings } = ssr(c.Comp, c.props)
      expect(body.length, `${c.name} should produce non-empty SSR body`).toBeGreaterThan(0)
      expect(errors, `${c.name} logged console.error during SSR`).toEqual([])
      expect(warnings, `${c.name} logged console.warn during SSR`).toEqual([])
    })
  }

  for (const c of cases) {
    it(`<${c.name}/> renders identical markup across two independent SSR passes (determinism)`, () => {
      // Two independent render() calls of the SAME tree. If structure drifted
      // run-to-run, the generated markup (and therefore a client hydrate's
      // target) would differ. `generateId()` is a monotonic global counter, so
      // the `iris-N` tokens legitimately advance between renders; normalize them
      // and assert the rest of the markup is byte-identical.
      const a = normalizeIds(ssr(c.Comp, c.props).body)
      const b = normalizeIds(ssr(c.Comp, c.props).body)
      expect(a).toBe(b)
    })
  }

  it('FormField wires <label for> and aria-describedby to ids that exist in the SSR output', () => {
    // FormField is the headline drift risk: it derives `${generateId()}-control`,
    // `-hint`, `-error` and wires them onto <label for>, the control id, and
    // aria-describedby. Every referenced id must resolve within the same render.
    const { body } = ssr(FormFieldHarness as Component<never>, {
      label: 'Email',
      hint: 'We never share it.',
    })
    const forIds = attrValues(body, 'for')
    expect(forIds.length).toBeGreaterThan(0)
    for (const id of forIds) {
      expect(hasId(body, id), `label for="${id}" has no matching element id in SSR body`).toBe(true)
    }
    for (const described of attrValues(body, 'aria-describedby')) {
      for (const id of described.split(/\s+/).filter(Boolean)) {
        expect(
          hasId(body, id),
          `aria-describedby="${id}" has no matching element id in SSR body`,
        ).toBe(true)
      }
    }
  })

  it('Accordion wires the open panel aria-controls / aria-labelledby to ids that exist in the SSR output', () => {
    // Render with item "a" open so its content panel is in the SSR output.
    // (Closed accordion panels are intentionally NOT rendered — the standard
    // ARIA disclosure pattern — so only the open panel's aria-controls is
    // expected to resolve; every header it labels always renders.)
    const { body } = ssr(AccordionHarness as Component<never>, { value: 'a' })
    // The open panel exposes role="region" + id + aria-labelledby pointing at
    // its trigger; the trigger's aria-controls points back at that panel.
    const labelledBy = attrValues(body, 'aria-labelledby')
    expect(labelledBy.length).toBeGreaterThan(0)
    for (const id of labelledBy) {
      expect(hasId(body, id), `aria-labelledby="${id}" has no matching header id`).toBe(true)
    }
    // The rendered region's own id must be the one the open trigger controls.
    const regionMatch = /role="region"[^>]*\sid="([^"]*)"/.exec(body)
    expect(regionMatch, 'expected an open accordion region in the SSR output').not.toBeNull()
    const regionId = regionMatch![1]
    expect(
      attrValues(body, 'aria-controls'),
      'open trigger should reference the rendered region id',
    ).toContain(regionId)
  })

  it('two FormFields in one tree get distinct (non-colliding) generated ids', () => {
    // Within a single server render, generateId() must hand out unique ids so
    // sibling fields do not cross-wire — and those ids are what a client hydrate
    // must reproduce.
    const { body } = ssr(TwoFormFieldsHarness as Component<never>, {})
    const forIds = attrValues(body, 'for')
    expect(forIds.length).toBe(2)
    expect(new Set(forIds).size).toBe(2)
  })
})
