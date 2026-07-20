// @vitest-environment jsdom
//
// REAL app-level hydration test for the ssr-next smoke app.
//
// The app's old `test` script was a placeholder ("build IS the test" — just
// `echo … && exit 0`), which proved a route server-RENDERS but never proved the
// browser can HYDRATE that exact HTML without a mismatch. A hydration mismatch
// (server HTML ≠ client first render) is the canonical production SSR bug, and
// React only ever surfaces it as a `console.error` / `console.warn` warning —
// never a throw. So this test does the same renderToString -> hydrateRoot dance
// the per-adapter test in packages/react/src/hydration.test.tsx does, but at the
// APP level: against the iris-component composition this app actually renders.
//
// We reproduce that composition DIRECTLY here (rather than importing app/Demo.tsx
// or app/page.tsx) to sidestep Next.js's RSC/router/'use client' machinery —
// none of which is relevant to the hydration question — while rendering the
// exact same iris-component tree the app ships: ThemeProvider wrapping a Button +
// Input + Badge row, the Dialog and Popover overlays (closed, so server-rendered
// as just their triggers), the data Table, and the "Add team member" IrisForm
// (validators wired, untouched/error-free initial state). The overlays' panels
// are portal/closed and intentionally produce no server HTML; their triggers do,
// and those must still hydrate cleanly.
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'

import {
  ThemeProvider,
  IrisButton,
  IrisInput,
  IrisBadge,
  IrisDialog,
  IrisDialogTrigger,
  IrisDialogContent,
  IrisDialogTitle,
  IrisDialogDescription,
  IrisDialogClose,
  IrisPopover,
  IrisPopoverTrigger,
  IrisPopoverContent,
  IrisTable,
  type IrisTableColumn,
  useForm,
  useField,
  IrisForm,
  IrisFormField,
} from '@iris-ui/react'
import { createThemeStore } from '@iris-ui/theme'
import { lightTheme, darkTheme } from '@iris-ui/tokens'

// `act` (and `hydrateRoot`'s internal warnings) require this global flag set, or
// React floods console.error with "not wrapped in act(...)" noise that could mask
// or be mistaken for a real warning.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// ── The app's iris-component composition, reproduced verbatim ───────────────
type Row = Record<string, unknown> & {
  id: number
  name: string
  role: string
  status: string
}

const rows: Row[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
  { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
  { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  {
    key: 'status',
    title: 'Status',
    render: (value) => (
      <IrisBadge tone={value === 'active' ? 'success' : 'warning'} variant="subtle">
        {String(value)}
      </IrisBadge>
    ),
  },
]

const themeStore = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

// Mirrors app/Demo.tsx's AddMemberForm exactly: useForm owns the store,
// useField reads it via context from a descendant of <IrisForm>, and both
// fields are required — the untouched initial state must be error-free on
// both the server render and the post-hydrate client render.
type MemberValues = { name: string; role: string }

function MemberNameField() {
  const field = useField<string>('name')
  return (
    <IrisFormField label="Name" required error={field.error}>
      <IrisInput placeholder="Jane Doe" {...field.inputProps} />
    </IrisFormField>
  )
}

function MemberRoleField() {
  const field = useField<string>('role')
  return (
    <IrisFormField label="Role" required error={field.error}>
      <IrisInput placeholder="Engineer" {...field.inputProps} />
    </IrisFormField>
  )
}

function AddMemberForm() {
  const [submitted, setSubmitted] = React.useState<MemberValues | null>(null)
  const form = useForm<MemberValues>({
    initialValues: { name: '', role: '' },
    validators: {
      name: (v) => (v.trim() ? undefined : 'Name is required'),
      role: (v) => (v.trim() ? undefined : 'Role is required'),
    },
    onSubmit: (values) => setSubmitted(values),
  })

  return (
    <div>
      <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Add team member</h2>
      <IrisForm form={form.form} style={{ display: 'grid', gap: 12, maxWidth: 320 }}>
        <MemberNameField />
        <MemberRoleField />
        <IrisButton type="submit" variant="solid" disabled={form.isSubmitting}>
          Add member
        </IrisButton>
      </IrisForm>
      {submitted ? (
        <p style={{ fontSize: 13, color: 'var(--iris-muted)', margin: '8px 0 0' }}>
          Added {submitted.name} as {submitted.role}.
        </p>
      ) : null}
    </div>
  )
}

/**
 * A factory (not a shared element) so the server tree and the client tree are
 * distinct instances built from identical inputs — exactly how real two-process
 * SSR works, and the only way an id/random drift between the two passes would be
 * caught. Mirrors app/Demo.tsx but as a stateless render of the initial state
 * (name = '', overlays closed), which is precisely what the server emits.
 */
function AppComposition() {
  const [name, setName] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)

  return (
    <ThemeProvider store={themeStore}>
      <section style={{ display: 'grid', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <IrisButton variant="solid">Primary action</IrisButton>
          <IrisInput
            placeholder="Type your name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <IrisBadge tone="primary" variant="solid">
            {name ? `Hi, ${name}` : 'live badge'}
          </IrisBadge>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <IrisDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <IrisDialogTrigger asChild>
              <IrisButton variant="outline">Open dialog</IrisButton>
            </IrisDialogTrigger>
            <IrisDialogContent>
              <IrisDialogTitle>Hydrated overlay</IrisDialogTitle>
              <IrisDialogDescription>
                This dialog was server-rendered closed and became interactive on hydration.
              </IrisDialogDescription>
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <IrisDialogClose asChild>
                  <IrisButton variant="solid">Close</IrisButton>
                </IrisDialogClose>
              </div>
            </IrisDialogContent>
          </IrisDialog>

          <IrisPopover>
            <IrisPopoverTrigger asChild>
              <IrisButton variant="ghost">Open popover</IrisButton>
            </IrisPopoverTrigger>
            <IrisPopoverContent>
              <div style={{ padding: 8, maxWidth: 220 }}>
                Floating content positioned by @floating-ui — client-only, never rendered on the
                server.
              </div>
            </IrisPopoverContent>
          </IrisPopover>
        </div>

        <div>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Team</h2>
          <IrisTable<Row> columns={columns} data={rows} rowKey="id" />
        </div>

        <AddMemberForm />
      </section>
    </ThemeProvider>
  )
}

/** React/Next phrase every hydration-mismatch warning with one of these markers. */
const MISMATCH_MARKERS = [
  'did not match',
  'Hydration failed',
  'hydrating',
  'server HTML',
  'tree mismatch',
  'Expected server HTML',
  'A tree hydrated but some attributes',
  "server rendered HTML didn't match",
  'Text content does not match',
]

function isHydrationWarning(args: unknown[]): boolean {
  const text = args
    .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : ''))
    .join(' ')
  return MISMATCH_MARKERS.some((m) => text.includes(m))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ssr-next app composition hydration', () => {
  it('runs in a real DOM (jsdom) environment', () => {
    // hydrateRoot needs a live `document`; if this regressed to the node env the
    // whole file would be vacuously green.
    expect(typeof document).not.toBe('undefined')
    expect(typeof window).not.toBe('undefined')
  })

  it('server HTML of the app composition hydrates with no mismatch warning', async () => {
    // 1. Server render. renderToString (not renderToStaticMarkup) keeps the
    //    hydration markers React needs to match against.
    const serverHtml = renderToString(<AppComposition />)

    // Sanity: the server actually emitted the iris content we expect to hydrate.
    expect(serverHtml).toContain('Primary action')
    expect(serverHtml).toContain('Ada Lovelace')
    expect(serverHtml).toContain('live badge')
    expect(serverHtml).toContain('Add team member')
    // The form is untouched on first render — its validators must NOT have
    // fired yet, so no error text should appear in the server markup. A
    // server-vs-client difference in *when* validation first runs (e.g. an
    // eager validate-on-mount that behaves differently with/without a DOM)
    // is exactly the class of SSR-only bug this section exists to catch.
    expect(serverHtml).not.toContain('Name is required')
    expect(serverHtml).not.toContain('Role is required')

    // 2. Plant that HTML into a real container, exactly as the browser receives
    //    the initial document.
    const container = document.createElement('div')
    container.innerHTML = serverHtml
    document.body.appendChild(container)

    // 3. Hydrate, spying on BOTH console.error and console.warn across the whole
    //    hydrate commit — React surfaces a mismatch only as a warning, never a
    //    throw.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(container, <AppComposition />)
      })

      // 4a. No hydration-mismatch warning fired on either channel.
      const mismatches = [...errorSpy.mock.calls, ...warnSpy.mock.calls].filter((call) =>
        isHydrationWarning(call),
      )
      expect(
        mismatches,
        `hydration mismatch in app composition:\n${mismatches.map((c) => c.join(' ')).join('\n')}`,
      ).toEqual([])

      // 4b. Sanity: the hydrated DOM still contains the iris content (hydration
      //    didn't blow the tree away / replace it). Reading the LIVE container
      //    proves the server markup survived hydration.
      expect(container.textContent).toContain('Primary action')
      expect(container.textContent).toContain('Ada Lovelace')
      expect(container.textContent).toContain('live badge')
      // IrisTable renders a CSS-grid layout with WAI-ARIA roles (role="table"),
      // not a native <table> element — assert the data grid survived hydration.
      expect(container.querySelector('[role="table"]')).not.toBeNull()
      // The form survived hydration, still untouched (no errors) — and its
      // native <form> element (IrisForm's `data-iris-form` marker) is present,
      // proving the validation-engine wiring reconciled cleanly.
      expect(container.textContent).toContain('Add team member')
      expect(container.querySelector('[data-iris-form]')).not.toBeNull()
      expect(container.querySelector('[data-iris-form-field-error]')).toBeNull()
    } finally {
      errorSpy.mockRestore()
      warnSpy.mockRestore()
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      container.remove()
    }
  })
})
