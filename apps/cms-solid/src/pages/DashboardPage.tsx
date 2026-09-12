import { createSignal, For, type JSX } from 'solid-js'
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
} from '@iris-ui-kit/solid'

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

export function DashboardPage(): JSX.Element {
  const base = Date.now()
  const [expiredFinishCount, setExpiredFinishCount] = createSignal(0)
  const [lastAction, setLastAction] = createSignal('none')

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
      <h1 class="page-title">Dashboard</h1>
      <p class="page-desc">
        Built entirely from existing Iris components — IrisDashboardGrid + Card, Badge — inside the
        IrisAdminLayout shell. Switch skins from the header to re-theme everything through tokens.
      </p>
      <IrisDashboardGrid columns={12} gap={16}>
        <For each={stats}>
          {(s) => (
            <IrisDashboardCard colSpan={3}>
              <div class="stat-label">{s.label}</div>
              <div class="stat-value">{s.value}</div>
              <IrisBadge tone={s.tone} variant="subtle">
                {s.delta}
              </IrisBadge>
            </IrisDashboardCard>
          )}
        </For>
        <IrisDashboardCard colSpan="full">
          <div class="stat-label">Welcome back 👋</div>
          <p style={{ margin: '8px 0 0', 'max-width': '70ch', 'line-height': 1.6 }}>
            This is a Vben-style CMS shell assembled from <code>@iris-ui-kit/solid</code>: a
            data-driven collapsible sidebar nav, a header breadcrumb, and a keep-alive multi-tab bar
            — all driven by one nav-tree config and the framework-agnostic stores in{' '}
            <code>@iris-ui-kit/core</code>
            (the same core that powers the React and Vue versions).
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
                'font-size': 'var(--iris-font-size-sm, 13px)',
              }}
            >
              Live release windows cover day/time formatting, millisecond precision, terminal state,
              and finish-event feedback.
            </p>
            <div
              style={{
                display: 'grid',
                gap: 'var(--iris-space-md, 16px)',
                'grid-template-columns': 'repeat(auto-fit, minmax(180px, 1fr))',
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
              <span data-iris-countdown-finish-count>{expiredFinishCount()}</span>
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
                'font-size': 'var(--iris-font-size-lg, 16px)',
              }}
            >
              Operations
            </h2>
            <p
              style={{
                margin: '0 0 var(--iris-space-md, 16px)',
                color: 'var(--iris-muted)',
                'font-size': 'var(--iris-font-size-sm, 13px)',
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
                    'border-radius': 'var(--iris-radius-md, 6px)',
                    background: 'var(--iris-surface)',
                    color: 'var(--iris-foreground)',
                    font: 'inherit',
                    'font-size': 'var(--iris-font-size-sm, 13px)',
                    cursor: 'pointer',
                  }}
                >
                  Operations
                </IrisMenuTrigger>
                <IrisMenuContent data-iris-dashboard-menu>
                  <IrisMenuItem onClick={handleRefreshActivity}>Refresh activity</IrisMenuItem>
                  <IrisMenuItem disabled onClick={handleExportReport}>
                    Export report
                  </IrisMenuItem>
                  <IrisMenuSeparator />
                  <IrisMenuSub label="More operations">
                    <IrisMenuItem onClick={handleViewAuditLog}>View audit log</IrisMenuItem>
                  </IrisMenuSub>
                </IrisMenuContent>
              </IrisMenu>

              <IrisScrollArea
                data-iris-dashboard-activity-feed
                role="region"
                aria-label="Activity feed"
                axis="vertical"
                maxHeight={180}
                style={{
                  border: '1px solid var(--iris-border)',
                  'border-radius': 'var(--iris-radius-md, 6px)',
                  background: 'var(--iris-surface)',
                  color: 'var(--iris-foreground)',
                  'font-size': 'var(--iris-font-size-sm, 13px)',
                }}
              >
                <For each={operationsActivity}>
                  {(activity) => (
                    <div
                      data-iris-dashboard-activity-row
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        'min-height': 'var(--iris-space-3xl, 48px)',
                        padding: 'var(--iris-space-sm, 8px) var(--iris-space-md, 16px)',
                        'border-block-end': '1px solid var(--iris-border)',
                      }}
                    >
                      {activity}
                    </div>
                  )}
                </For>
              </IrisScrollArea>

              <output
                data-iris-dashboard-action
                aria-live="polite"
                style={{
                  display: 'block',
                  margin: 0,
                  padding: 'var(--iris-space-sm, 12px) var(--iris-space-md, 16px)',
                  border: '1px solid var(--iris-border)',
                  'border-radius': 'var(--iris-radius-md, 6px)',
                  color: 'var(--iris-muted)',
                  'font-size': 'var(--iris-font-size-sm, 13px)',
                }}
              >
                Last action: {lastAction()}
              </output>
            </div>
          </section>
        </IrisDashboardCard>
      </IrisDashboardGrid>
    </section>
  )
}
