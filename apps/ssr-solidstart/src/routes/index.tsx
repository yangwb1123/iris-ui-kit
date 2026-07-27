import {
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
import { createSignal } from 'solid-js'

const rows: Record<string, unknown>[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
  { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
  { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
]
const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'status', title: 'Status' },
]

export default function Page() {
  const [name, setName] = createSignal('')
  const [dialogOpen, setDialogOpen] = createSignal(false)

  return (
    <>
      <header style={{ 'margin-bottom': '28px' }}>
        <IrisBadge tone="primary" variant="solid">
          SSR + hydration
        </IrisBadge>
        <h1 style={{ margin: '12px 0 6px', 'font-size': '28px' }}>Iris UI SolidStart reference</h1>
        <p style={{ margin: 0, color: 'var(--iris-muted-foreground)' }}>
          A file-routed SolidStart application. This page is rendered on the server, then its Iris
          controls hydrate into an interactive experience.
        </p>
      </header>

      <section style={{ display: 'grid', gap: '24px' }} data-hydration-demo="solidstart">
        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: '12px',
            'flex-wrap': 'wrap',
          }}
        >
          <IrisButton variant="solid">Primary action</IrisButton>
          <IrisInput
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            placeholder="Type your name…"
            style={{ 'max-width': '240px' }}
          />
          <IrisBadge tone="primary" variant="solid">
            {name() ? `Hi, ${name()}` : 'live badge'}
          </IrisBadge>
        </div>

        <div style={{ display: 'flex', gap: '12px', 'flex-wrap': 'wrap' }}>
          <IrisDialog open={dialogOpen()} onOpenChange={setDialogOpen}>
            <IrisDialogTrigger
              style={{
                padding: 'var(--iris-padding-sm) var(--iris-padding-lg)',
                color: 'var(--iris-primary)',
                background: 'transparent',
                border: '1px solid var(--iris-border)',
                'border-radius': 'var(--iris-radius-md)',
                cursor: 'pointer',
              }}
            >
              Open dialog
            </IrisDialogTrigger>
            <IrisDialogContent>
              <IrisDialogTitle>Hydrated overlay</IrisDialogTitle>
              <IrisDialogDescription>
                This dialog was server-rendered closed and became interactive on hydration.
              </IrisDialogDescription>
              <div style={{ 'margin-top': '16px', 'text-align': 'right' }}>
                <IrisDialogClose
                  style={{
                    padding: 'var(--iris-padding-sm) var(--iris-padding-lg)',
                    color: 'var(--iris-primary-foreground)',
                    background: 'var(--iris-primary)',
                    border: '1px solid var(--iris-primary)',
                    'border-radius': 'var(--iris-radius-md)',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </IrisDialogClose>
              </div>
            </IrisDialogContent>
          </IrisDialog>
        </div>

        <div>
          <h2 style={{ 'font-size': '16px', margin: '0 0 8px' }}>Hydrated team table</h2>
          <IrisTable columns={columns} data={rows} rowKey="id" />
        </div>
      </section>
    </>
  )
}
