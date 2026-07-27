import { IrisDashboardGrid, IrisDashboardCard, IrisBadge } from '@iris-ui-kit/react'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
const stats: { label: string; value: string; delta: string; tone: Tone }[] = [
  { label: 'Total users', value: '12,480', delta: '+4.2%', tone: 'primary' },
  { label: 'Articles', value: '3,914', delta: '+1.1%', tone: 'success' },
  { label: 'Open tickets', value: '57', delta: '-12%', tone: 'warning' },
  { label: 'Errors (24h)', value: '3', delta: '-2', tone: 'danger' },
]

export function DashboardPage() {
  return (
    <section>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-desc">
        Built entirely from existing Iris components — IrisDashboardGrid + Card, Badge — inside the
        IrisAdminLayout shell. Switch skins from the header to re-theme everything through tokens.
      </p>
      <IrisDashboardGrid columns={12} gap={16}>
        {stats.map((s) => (
          <IrisDashboardCard key={s.label} colSpan={3}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <IrisBadge tone={s.tone} variant="subtle">
              {s.delta}
            </IrisBadge>
          </IrisDashboardCard>
        ))}
        <IrisDashboardCard colSpan="full">
          <div className="stat-label">Welcome back 👋</div>
          <p style={{ margin: '8px 0 0', maxWidth: '70ch', lineHeight: 1.6 }}>
            This is a Vben-style CMS shell assembled from <code>@iris-ui-kit/react/admin</code>: a
            data-driven collapsible sidebar nav, a header breadcrumb, and a keep-alive multi-tab bar
            — all driven by one nav-tree config and the framework-agnostic stores in{' '}
            <code>@iris-ui-kit/core</code> (shared with the Vue version).
          </p>
        </IrisDashboardCard>
      </IrisDashboardGrid>
    </section>
  )
}
