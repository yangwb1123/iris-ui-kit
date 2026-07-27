'use client'

import { useState } from 'react'
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
} from '@iris-ui-kit/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

// ── Client island ──────────────────────────────────────────────────────────
// Everything below runs in the browser after hydration. The `'use client'`
// directive at the top of THIS file is the boundary; @iris-ui-kit/react entries
// also carry their own injected directive, so importing them from a Server
// Component (app/page.tsx) is legal either way. This component is what proves
// hydration: it mounts interactive state (useState), an overlay that opens on
// click, and a data grid — all of which must reconcile against the
// server-rendered HTML without a mismatch.

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

// A single theme store, created once on the client. ThemeProvider injects the
// CSS custom properties via a layout effect (client-only — no SSR DOM access).
const themeStore = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

// ── Form: the most stateful/validation-heavy component class ────────────────
// `useForm` owns the form store; each field is its own component so `useField`
// (which reads the store via context) is a descendant of `<IrisForm>` rather
// than a sibling call in the same render. Both fields are required — the
// validators run on change/blur and must produce zero errors in the initial
// (untouched) server-rendered state, matching every other overlay/table
// section on this page that server-renders inert and wires up on hydration.
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
  const [submitted, setSubmitted] = useState<MemberValues | null>(null)
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

export function Demo() {
  const [name, setName] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <ThemeProvider store={themeStore}>
      <section style={{ display: 'grid', gap: 24 }}>
        {/* Basics: button + input + badge */}
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

        {/* Overlay #1: Dialog — closed by default, opens on hydration-driven click */}
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

          {/* Overlay #2: Popover — also closed by default */}
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

        {/* Data component: Table */}
        <div>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Team</h2>
          <IrisTable<Row> columns={columns} data={rows} rowKey="id" />
        </div>

        {/* Form: multi-field state + validation-engine wiring, closed to
            interaction until hydration wires the change/blur/submit handlers */}
        <AddMemberForm />
      </section>
    </ThemeProvider>
  )
}
