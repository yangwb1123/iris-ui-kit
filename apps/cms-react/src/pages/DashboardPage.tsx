import { useState } from 'react'
import { IrisDashboardGrid, IrisDashboardCard, IrisBadge, IrisCountdown } from '@iris-ui-kit/react'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
const stats: { label: string; value: string; delta: string; tone: Tone }[] = [
  { label: 'Total users', value: '12,480', delta: '+4.2%', tone: 'primary' },
  { label: 'Articles', value: '3,914', delta: '+1.1%', tone: 'success' },
  { label: 'Open tickets', value: '57', delta: '-12%', tone: 'warning' },
  { label: 'Errors (24h)', value: '3', delta: '-2', tone: 'danger' },
]

export function DashboardPage() {
  const [base] = useState(() => Date.now())
  const [expiredFinishCount, setExpiredFinishCount] = useState(0)

  const handleExpiredFinish = (): void => {
    setExpiredFinishCount((count) => count + 1)
  }

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

        <IrisDashboardCard colSpan="full">
          <section
            data-iris-countdown-example="dashboard-release"
            aria-labelledby="dashboard-release-heading"
          >
            <h2 id="dashboard-release-heading" style={{ margin: '0 0 var(--iris-space-xs, 8px)' }}>
              Release countdown
            </h2>
            <p
              style={{
                margin: '0 0 var(--iris-space-md, 16px)',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
              }}
            >
              Live release windows cover day/time formatting, millisecond precision, terminal state,
              and finish-event feedback.
            </p>
            <div
              style={{
                display: 'grid',
                gap: 'var(--iris-space-md, 16px)',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}
            >
              <IrisCountdown
                value={base + 90_061_000}
                format="DD HH:mm:ss"
                title="Next release"
                prefix="T-"
                suffix="until launch"
                size="sm"
              />
              <IrisCountdown
                value={base + 12_345}
                format="ss.SSS"
                title="Millisecond precision"
                size="md"
              />
              <IrisCountdown
                value={base - 1_000}
                format="HH:mm:ss"
                title="Expired release"
                size="lg"
                onFinish={handleExpiredFinish}
              />
            </div>
            <p
              aria-live="polite"
              style={{ margin: 'var(--iris-space-md, 16px) 0 0', color: 'var(--iris-muted)' }}
            >
              Expired finish callbacks:{' '}
              <span data-iris-countdown-finish-count>{expiredFinishCount}</span>
            </p>
          </section>
        </IrisDashboardCard>
      </IrisDashboardGrid>
    </section>
  )
}
