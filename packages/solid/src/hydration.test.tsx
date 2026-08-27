/**
 * SSR + hydration-safety test for the SSR-safe (non-overlay) component subset.
 *
 * Runs under the DEDICATED SSR config (`vitest.ssr.config.ts`):
 *   `vitest run --config vitest.ssr.config.ts` (wired into the package
 *   `test` script). It is EXCLUDED from the default `vitest.config.ts` because
 *   `renderToString` is only available from solid-js/web's *server* build
 *   (`node` resolve condition), and components must be compiled
 *   `generate: 'ssr'` + `hydratable: true` — neither of which the default
 *   (browser-condition, DOM-compiled) config provides. The production
 *   `tsup.config.ts` is NOT changed by any of this.
 *
 * --------------------------------------------------------------------------
 * WHY THIS IS AN SSR + ID-DETERMINISM SMOKE TEST, NOT A LIVE `hydrate()` TEST
 * --------------------------------------------------------------------------
 * The flagged risk is Solid's `createUniqueId()` drifting between the server
 * render and the client hydrate, which silently breaks label/control wiring
 * (`<label for>` / `aria-describedby`). To exercise that, you need BOTH:
 *   1. `renderToString` — lives in solid-js/web's server build, reachable only
 *      via the `node`/`worker` resolve condition; needs SSR-compiled components.
 *   2. `hydrate`        — lives in solid-js/web's client build (`browser`
 *      condition); needs DOM-compiled components.
 * Those two builds are mutually exclusive within a single Vitest module graph:
 * one resolve condition + one Solid compile target per config. Empirically, in
 * a jsdom/`browser` config `renderToString` is a stub that returns `undefined`
 * ("not supported in the browser"); in a `node`/SSR config `hydrate` has no DOM
 * runtime. A real in-process `hydrate()` therefore requires dual module graphs
 * (separate SSR + client transform pipelines sharing one jsdom) — brittle
 * machinery the task explicitly says to scope down from.
 *
 * So this test instead PROVES the actual hydration-breaking failure mode
 * directly and deterministically:
 *   (a) every component in the SSR-safe subset server-renders to non-empty
 *       hydratable markup with NO console.error / console.warn;
 *   (b) `createUniqueId()` is DETERMINISTIC across two independent server
 *       renders of the same tree — the exact drift guard (if SSR ids differed
 *       run-to-run, client hydrate ids could never match them);
 *   (c) the id wiring is INTERNALLY CONSISTENT — every `for` / `aria-describedby`
 *       / `aria-labelledby` reference in the SSR output points at an element
 *       that actually exists in that same output (a mismatch here is precisely
 *       what a hydration drift would surface as).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToString } from 'solid-js/web'
import type { JSX } from 'solid-js'

import { IrisButton } from './primitives/button'
import { IrisBadge } from './primitives/badge'
import { IrisChip } from './primitives/chip'
import { IrisDivider } from './primitives/divider'
import { IrisAlert } from './primitives/alert'
import { IrisCard } from './primitives/card'
import { IrisSpinner } from './primitives/spinner'
import { IrisInput } from './primitives/input'
import { IrisTextarea } from './primitives/textarea'
import { IrisCheckbox } from './primitives/checkbox'
import { IrisSwitch } from './primitives/switch'
import { IrisFormField } from './primitives/form-field'
import { IrisAccordion, IrisAccordionItem } from './primitives/accordion'
import { IrisRadioGroup, IrisRadio } from './primitives/radio'
import { IrisTable } from './primitives/table'

// Each case is an SSR-safe, non-overlay component (no portal / floating-ui /
// document-dependent render path). The components whose render reads
// `createUniqueId()` — FormField, RadioGroup, Accordion — are the ones the
// drift guard most cares about, so they are included deliberately.
const cases: { name: string; render: () => JSX.Element }[] = [
  { name: 'Button', render: () => <IrisButton>Click me</IrisButton> },
  { name: 'Badge', render: () => <IrisBadge>New</IrisBadge> },
  { name: 'Chip', render: () => <IrisChip>Tag</IrisChip> },
  { name: 'Divider', render: () => <IrisDivider label="Section" /> },
  {
    name: 'Alert',
    render: () => (
      <IrisAlert tone="info" title="Heads up">
        Body text
      </IrisAlert>
    ),
  },
  {
    name: 'Card',
    render: () => (
      <IrisCard header={<span>Header</span>} footer={<span>Footer</span>}>
        Card body
      </IrisCard>
    ),
  },
  { name: 'Spinner', render: () => <IrisSpinner /> },
  { name: 'Input', render: () => <IrisInput placeholder="Name" value="hi" /> },
  { name: 'Textarea', render: () => <IrisTextarea placeholder="Bio" rows={3} /> },
  { name: 'Checkbox', render: () => <IrisCheckbox defaultChecked>Accept</IrisCheckbox> },
  { name: 'Switch', render: () => <IrisSwitch defaultChecked /> },
  {
    name: 'FormField',
    render: () => (
      <IrisFormField label="Email" hint="We never share it." error="">
        <IrisInput type="email" />
      </IrisFormField>
    ),
  },
  {
    name: 'FormField (invalid)',
    render: () => (
      <IrisFormField label="Email" error="Required">
        <IrisInput type="email" />
      </IrisFormField>
    ),
  },
  {
    name: 'Accordion',
    render: () => (
      <IrisAccordion defaultValue="a">
        <IrisAccordionItem value="a" title="First">
          Panel A
        </IrisAccordionItem>
        <IrisAccordionItem value="b" title="Second">
          Panel B
        </IrisAccordionItem>
      </IrisAccordion>
    ),
  },
  {
    name: 'RadioGroup',
    render: () => (
      <IrisRadioGroup defaultValue="a">
        <IrisRadio value="a">A</IrisRadio>
        <IrisRadio value="b">B</IrisRadio>
        <IrisRadio value="c">C</IrisRadio>
      </IrisRadioGroup>
    ),
  },
  {
    name: 'Table (printable)',
    render: () => (
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={[{ id: 1, name: 'Alpha' }]}
        rowKey="id"
        printable
      />
    ),
  },
  {
    name: 'Table (undo)',
    render: () => (
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={[{ id: 1, name: 'Alpha' }]}
        rowKey="id"
        undo
      />
    ),
  },
]

afterEach(() => {
  vi.restoreAllMocks()
})

/** Renders a case under spied console.error/console.warn; returns html + logs. */
function ssr(render: () => JSX.Element): {
  html: string
  errors: unknown[][]
  warnings: unknown[][]
} {
  const errors: unknown[][] = []
  const warnings: unknown[][] = []
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a) => {
    errors.push(a)
  })
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...a) => {
    warnings.push(a)
  })
  let html = ''
  try {
    html = renderToString(render)
  } finally {
    errSpy.mockRestore()
    warnSpy.mockRestore()
  }
  return { html, errors, warnings }
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

describe('@iris-ui-kit/solid — SSR render + createUniqueId drift guard (non-overlay subset)', () => {
  it('the SSR build exposes a working renderToString (sanity)', () => {
    const { html } = ssr(() => <IrisButton>Hi</IrisButton>)
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
    // SSR-compiled + hydratable output carries hydration keys / markers.
    expect(html).toMatch(/data-hk=/)
  })

  it('Button asChild SSR emits one merged child element with no wrapper', () => {
    const { html, errors, warnings } = ssr(() => (
      <IrisButton asChild id="ssr-link" class="parent" style={{ color: 'red' }}>
        <a href="/save" class="child" style={{ color: 'blue' }}>
          Save link
        </a>
      </IrisButton>
    ))

    expect(html).not.toContain('<button')
    expect(html.match(/<a\b/g)).toHaveLength(1)
    expect(html).toContain('id="ssr-link"')
    expect(html).toContain('class="iris-button parent child"')
    expect(html).toContain('color:blue')
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('Table printable SSR emits the shared print marker', () => {
    const { html, errors, warnings } = ssr(() => (
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={[{ id: 1, name: 'Alpha' }]}
        rowKey="id"
        printable
      />
    ))
    expect(html).toContain('data-printable="true"')
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('Table proxy SSR keeps non-empty remote filters without running the query', () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'Alice' }], total: 1 }))
    const { html, errors, warnings } = ssr(() => (
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={[]}
        rowKey="id"
        filters={{ name: 'Alice' }}
        proxyConfig={{ query, remoteFilter: true }}
      />
    ))
    expect(query).not.toHaveBeenCalled()
    expect(html).toContain('data-iris-table-row="empty"')
    expect(html).not.toContain('data-iris-table-row="loading"')
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  for (const c of cases) {
    it(`server-renders <${c.name}/> with no console error/warn`, () => {
      const { html, errors, warnings } = ssr(c.render)
      expect(html.length, `${c.name} should produce non-empty SSR html`).toBeGreaterThan(0)
      expect(errors, `${c.name} logged console.error during SSR`).toEqual([])
      expect(warnings, `${c.name} logged console.warn during SSR`).toEqual([])
    })
  }

  for (const c of cases) {
    it(`<${c.name}/> renders identical markup across two independent SSR passes (id determinism)`, () => {
      // Two independent renderToString calls of the SAME tree. If
      // createUniqueId drifted run-to-run, generated ids (and therefore the
      // whole string) would differ — the precise condition that makes a
      // client hydrate fail to match the server output. Solid resets its
      // per-render unique-id counter for each renderToString, so a stable tree
      // must serialize byte-identically.
      const a = ssr(c.render).html
      const b = ssr(c.render).html
      expect(a).toBe(b)
    })
  }

  it('FormField wires <label for> and aria-describedby to ids that exist in the SSR output', () => {
    // FormField is the headline drift risk: it derives `${createUniqueId()}-control`,
    // `-hint`, `-error` and wires them onto <label for>, the control id, and
    // aria-describedby. Every referenced id must resolve within the same render.
    const { html } = ssr(() => (
      <IrisFormField label="Email" hint="We never share it.">
        <IrisInput type="email" />
      </IrisFormField>
    ))
    const forIds = attrValues(html, 'for')
    expect(forIds.length).toBeGreaterThan(0)
    for (const id of forIds) {
      expect(hasId(html, id), `label for="${id}" has no matching element id in SSR html`).toBe(true)
    }
    for (const described of attrValues(html, 'aria-describedby')) {
      for (const id of described.split(/\s+/).filter(Boolean)) {
        expect(
          hasId(html, id),
          `aria-describedby="${id}" has no matching element id in SSR html`,
        ).toBe(true)
      }
    }
  })

  it('two FormFields in one tree get distinct (non-colliding) generated ids', () => {
    // Within a single server render, createUniqueId must hand out unique ids so
    // sibling fields do not cross-wire — and those same ids are what the client
    // must reproduce on hydrate.
    const { html } = ssr(() => (
      <div>
        <IrisFormField label="First">
          <IrisInput />
        </IrisFormField>
        <IrisFormField label="Second">
          <IrisInput />
        </IrisFormField>
      </div>
    ))
    const forIds = attrValues(html, 'for')
    expect(forIds.length).toBe(2)
    expect(new Set(forIds).size).toBe(2)
  })
})
