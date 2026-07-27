import { IrisBadge, IrisTable } from '@iris-ui-kit/solid'
import { createAsync, type RouteDefinition } from '@solidjs/router'
import { Show, Suspense } from 'solid-js'
import { getTeam } from '../demo-server'

export const route = {
  preload: () => getTeam(),
} satisfies RouteDefinition

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'status', title: 'Status' },
]

export default function DataPage() {
  const payload = createAsync(() => getTeam())

  return (
    <>
      <header style={{ 'margin-bottom': '28px' }}>
        <IrisBadge tone="success" variant="solid">
          SolidStart query
        </IrisBadge>
        <h1 style={{ margin: '12px 0 6px', 'font-size': '28px' }}>Server data</h1>
        <p style={{ margin: 0, color: 'var(--iris-muted-foreground)' }}>
          The team query ran during SSR and SolidStart serialized its result for hydration.
        </p>
      </header>

      <section aria-labelledby="team-heading" data-ssr-source="solidstart-query">
        <Suspense fallback={<p role="status">Loading server data…</p>}>
          <Show when={payload()} keyed>
            {(data) => (
              <>
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'baseline',
                    'justify-content': 'space-between',
                    gap: '12px',
                    'margin-bottom': '10px',
                  }}
                >
                  <h2 id="team-heading" style={{ 'font-size': '18px', margin: 0 }}>
                    Loaded on the server
                  </h2>
                  <span style={{ color: 'var(--iris-muted-foreground)', 'font-size': '13px' }}>
                    {data.generatedAt}
                  </span>
                </div>
                <IrisTable columns={columns} data={data.rows} rowKey="id" />
              </>
            )}
          </Show>
        </Suspense>
      </section>
    </>
  )
}
