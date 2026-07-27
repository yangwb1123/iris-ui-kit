import { IrisBadge } from '@iris-ui-kit/react'
import { DataTable, type TeamRow } from './DataTable'

const rows: TeamRow[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
  { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
  { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
]

async function loadTeam() {
  return {
    generatedAt: 'Rendered by a Next.js Server Component',
    rows,
  }
}

export default async function DataPage() {
  const payload = await loadTeam()

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px' }}>
      <header style={{ marginBottom: 28 }}>
        <IrisBadge tone="success" variant="solid">
          Next.js Server Component
        </IrisBadge>
        <h1 style={{ margin: '12px 0 6px', fontSize: 28 }}>Server data</h1>
        <p style={{ margin: 0, color: 'var(--iris-muted-foreground)' }}>
          The team query ran during SSR and its serializable result crossed into an Iris client
          table.
        </p>
        <nav aria-label="SSR reference routes" style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <a href="/">Interactive demo</a>
          <a href="/feedback">Feedback</a>
        </nav>
      </header>

      <section aria-labelledby="team-heading" data-ssr-source="next-server-component">
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h2 id="team-heading" style={{ fontSize: 18, margin: 0 }}>
            Loaded on the server
          </h2>
          <span style={{ color: 'var(--iris-muted-foreground)', fontSize: 13 }}>
            {payload.generatedAt}
          </span>
        </div>
        <DataTable rows={payload.rows} />
      </section>
    </main>
  )
}
