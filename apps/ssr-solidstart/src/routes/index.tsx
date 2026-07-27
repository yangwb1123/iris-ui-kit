// @ts-nocheck
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
  IrisTable,
} from '@iris-ui-kit/solid'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'
import { createSignal, type JSX } from 'solid-js'

interface Row {
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
const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'status', title: 'Status' },
]
const themeStore = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

export default function Page() {
  const [name, setName] = createSignal('')
  const [dialogOpen, setDialogOpen] = createSignal(false)

  return (
    <ThemeProvider store={themeStore}>
      <main style={{ maxWidth: '880px', margin: '0 auto', padding: '40px 24px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px' }}>Iris UI · SolidStart SSR smoke</h1>
          <p style={{ margin: 0, color: 'var(--iris-muted-foreground, #666)' }}>
            Server-rendered page (<code>src/routes/index.tsx</code>) built from{' '}
            <code>@iris-ui-kit/solid</code>. A successful <code>vinxi build</code> is the SSR-compat
            proof.
          </p>
        </header>

        <section style={{ display: 'grid', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <IrisButton variant="solid">Primary action</IrisButton>
            <IrisInput
              value={name()}
              onChange={(e: Event) => setName((e.target as HTMLInputElement).value)}
              placeholder="Type your name…"
              style={{ maxWidth: '240px' }}
            />
            <IrisBadge tone="primary" variant="solid">
              {name() ? `Hi, ${name()}` : 'live badge'}
            </IrisBadge>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <IrisDialog open={dialogOpen()} onOpenChange={setDialogOpen}>
              <IrisDialogTrigger asChild>
                <IrisButton variant="outline">Open dialog</IrisButton>
              </IrisDialogTrigger>
              <IrisDialogContent>
                <IrisDialogTitle>Hydrated overlay</IrisDialogTitle>
                <IrisDialogDescription>
                  This dialog was server-rendered closed and became interactive on hydration.
                </IrisDialogDescription>
                <div style={{ marginTop: '16px', textAlign: 'right' }}>
                  <IrisDialogClose asChild>
                    <IrisButton variant="solid">Close</IrisButton>
                  </IrisDialogClose>
                </div>
              </IrisDialogContent>
            </IrisDialog>
          </div>

          <div>
            <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>Team</h2>
            <IrisTable columns={columns} data={rows} rowKey="id" />
          </div>
        </section>
      </main>
    </ThemeProvider>
  )
}
