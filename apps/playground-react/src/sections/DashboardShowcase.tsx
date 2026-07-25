import { IrisDashboard, type DashboardConfig } from '@iris-ui/plugin-dashboard/react'

const DASHBOARD_CONFIG: DashboardConfig = {
  columns: 4,
  widgets: [
    { id: 'w1', title: 'Revenue', col: 1, row: 1, colSpan: 2, rowSpan: 1 },
    { id: 'w2', title: 'Users', col: 3, row: 1, colSpan: 1, rowSpan: 1 },
    { id: 'w3', title: 'Performance', col: 4, row: 1, colSpan: 1, rowSpan: 2 },
    { id: 'w4', title: 'Activity Feed', col: 1, row: 2, colSpan: 2, rowSpan: 1 },
    { id: 'w5', title: 'Alerts', col: 3, row: 2, colSpan: 1, rowSpan: 1 },
    { id: 'w6', title: 'Summary', col: 1, row: 3, colSpan: 4, rowSpan: 1 },
  ],
}

export function DashboardShowcase() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Dashboard Grid</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          Draggable dashboard grid from <code>@iris-ui/plugin-dashboard</code>. Widgets can be moved
          by dragging their header (desktop) or via touch.
        </p>

        <div style={{ minHeight: 500 }}>
          <IrisDashboard config={DASHBOARD_CONFIG} style={{ width: '100%' }} />
        </div>
      </section>
    </div>
  )
}
