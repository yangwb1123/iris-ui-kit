import { useState } from 'react'
import {
  IrisDashboardGrid,
  IrisDashboardCard,
  IrisBadge,
  IrisCountdown,
  IrisMenu,
  IrisMenuTrigger,
  IrisMenuContent,
  IrisMenuItem,
  IrisMenuSeparator,
  IrisMenuSub,
  IrisScrollArea,
} from '@iris-ui-kit/react'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
const stats: { label: string; value: string; delta: string; tone: Tone }[] = [
  { label: 'Total users', value: '12,480', delta: '+4.2%', tone: 'primary' },
  { label: 'Articles', value: '3,914', delta: '+1.1%', tone: 'success' },
  { label: 'Open tickets', value: '57', delta: '-12%', tone: 'warning' },
  { label: 'Errors (24h)', value: '3', delta: '-2', tone: 'danger' },
]

const operationsActivity = [
  'Build #1842 promoted to production',
  'Mira approved release notes',
  'API latency returned to normal',
  'Scheduled backup completed',
  'New editor role created',
  'Webhook delivery retried',
  'Security scan passed',
  'Audit policy updated',
]

const activityFeedAttrs = {
  'data-iris-dashboard-activity-feed': '',
  role: 'region',
  'aria-label': 'Activity feed',
}

export function DashboardPage() {
  const [base] = useState(() => Date.now())
  const [expiredFinishCount, setExpiredFinishCount] = useState(0)
  const [lastAction, setLastAction] = useState('none')

  const handleExpiredFinish = (): void => {
    setExpiredFinishCount((count) => count + 1)
  }

  const handleRefreshActivity = (): void => {
    setLastAction('Refresh activity')
  }

  const handleExportReport = (): void => {
    // The disabled menu item intentionally leaves the action feedback unchanged.
  }

  const handleViewAuditLog = (): void => {
    setLastAction('View audit log')
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

        <IrisDashboardCard colSpan="full">
          <section
            data-iris-dashboard-section="operations"
            aria-labelledby="dashboard-operations-heading"
          >
            <h2
              id="dashboard-operations-heading"
              style={{
                margin: '0 0 var(--iris-space-xs, 8px)',
                fontSize: 'var(--iris-font-size-lg, 16px)',
              }}
            >
              Operations
            </h2>
            <p
              style={{
                margin: '0 0 var(--iris-space-md, 16px)',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
              }}
            >
              Use the menu to manage activity and review the loaded feed. Disabled actions remain
              unavailable.
            </p>
            <div style={{ display: 'grid', gap: 'var(--iris-space-md, 16px)' }}>
              <IrisMenu>
                <IrisMenuTrigger
                  data-iris-dashboard-menu-trigger
                  style={{
                    padding: 'var(--iris-space-xs, 8px) var(--iris-space-md, 16px)',
                    border: '1px solid var(--iris-border)',
                    borderRadius: 'var(--iris-radius-md, 6px)',
                    background: 'var(--iris-surface)',
                    color: 'var(--iris-foreground)',
                    font: 'inherit',
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    cursor: 'pointer',
                  }}
                >
                  Operations
                </IrisMenuTrigger>
                <IrisMenuContent data-iris-dashboard-menu>
                  <IrisMenuItem onSelect={handleRefreshActivity}>Refresh activity</IrisMenuItem>
                  <IrisMenuItem disabled onSelect={handleExportReport}>
                    Export report
                  </IrisMenuItem>
                  <IrisMenuSeparator />
                  <IrisMenuSub label="More operations">
                    <IrisMenuItem onSelect={handleViewAuditLog}>View audit log</IrisMenuItem>
                  </IrisMenuSub>
                </IrisMenuContent>
              </IrisMenu>

              <IrisScrollArea
                {...activityFeedAttrs}
                axis="vertical"
                maxHeight={180}
                style={{
                  border: '1px solid var(--iris-border)',
                  borderRadius: 'var(--iris-radius-md, 6px)',
                  background: 'var(--iris-surface)',
                  color: 'var(--iris-foreground)',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                }}
              >
                {operationsActivity.map((activity) => (
                  <div
                    key={activity}
                    data-iris-dashboard-activity-row
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 'var(--iris-space-3xl, 48px)',
                      padding: 'var(--iris-space-sm, 8px) var(--iris-space-md, 16px)',
                      borderBlockEnd: '1px solid var(--iris-border)',
                    }}
                  >
                    {activity}
                  </div>
                ))}
              </IrisScrollArea>

              <output
                data-iris-dashboard-action
                aria-live="polite"
                style={{
                  display: 'block',
                  margin: 0,
                  padding: 'var(--iris-space-sm, 12px) var(--iris-space-md, 16px)',
                  border: '1px solid var(--iris-border)',
                  borderRadius: 'var(--iris-radius-md, 6px)',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                }}
              >
                Last action: {lastAction}
              </output>
            </div>
          </section>
        </IrisDashboardCard>
      </IrisDashboardGrid>
    </section>
  )
}
