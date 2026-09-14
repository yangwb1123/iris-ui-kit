<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisDashboardGrid,
  IrisDashboardCard,
  IrisBadge,
  IrisCountdown,
  IrisLongPress,
  IrisMenu,
  IrisMenuTrigger,
  IrisMenuContent,
  IrisMenuItem,
  IrisMenuSeparator,
  IrisMenuSub,
  IrisScrollArea,
} from '@iris-ui-kit/vue'

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

const base = Date.now()
const expiredFinishCount = ref(0)
const lastAction = ref('none')
const longPressCount = ref(0)
const longPressLastAction = ref('none')

function handleLongPress(): void {
  longPressCount.value += 1
  longPressLastAction.value = 'completed hold'
}

function handleExpiredFinish(): void {
  expiredFinishCount.value += 1
}

function handleRefreshActivity(): void {
  lastAction.value = 'Refresh activity'
}

function handleExportReport(): void {
  // The disabled menu item intentionally leaves the action feedback unchanged.
}

function handleViewAuditLog(): void {
  lastAction.value = 'View audit log'
}
</script>

<template>
  <section>
    <h1 class="page-title">Dashboard</h1>
    <p class="page-desc">
      Built entirely from existing Iris components — IrisDashboardGrid + Card, Badge — inside the
      IrisAdminLayout shell. Switch skins from the header to re-theme everything through tokens.
    </p>
    <IrisDashboardGrid :columns="12" :gap="16">
      <IrisDashboardCard v-for="s in stats" :key="s.label" :col-span="3">
        <div class="stat-label">{{ s.label }}</div>
        <div class="stat-value">{{ s.value }}</div>
        <IrisBadge :tone="s.tone" variant="subtle">{{ s.delta }}</IrisBadge>
      </IrisDashboardCard>

      <IrisDashboardCard col-span="full">
        <div class="stat-label">Welcome back 👋</div>
        <p style="margin: 8px 0 0; max-width: 70ch; line-height: 1.6">
          This is a Vben-style CMS shell assembled from <code>@iris-ui-kit/vue/admin</code>: a
          data-driven collapsible sidebar nav, a header breadcrumb, and a keep-alive multi-tab bar —
          all driven by one nav-tree config and the framework-agnostic stores in
          <code>@iris-ui-kit/core</code>.
        </p>
      </IrisDashboardCard>

      <IrisDashboardCard col-span="full">
        <section
          data-iris-countdown-example="dashboard-release"
          aria-labelledby="dashboard-release-heading"
        >
          <h2 id="dashboard-release-heading" style="margin: 0 0 var(--iris-space-xs, 8px)">
            Release countdown
          </h2>
          <p
            style="
              margin: 0 0 var(--iris-space-md, 16px);
              color: var(--iris-muted);
              font-size: var(--iris-font-size-sm, 13px);
            "
          >
            Live release windows cover day/time formatting, millisecond precision, terminal state,
            and finish-event feedback.
          </p>
          <div
            style="
              display: grid;
              gap: var(--iris-space-md, 16px);
              grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            "
          >
            <IrisCountdown
              :value="base + 90_061_000"
              format="DD HH:mm:ss"
              title="Next release"
              prefix="T-"
              suffix="until launch"
              size="sm"
            />
            <IrisCountdown
              :value="base + 12_345"
              format="ss.SSS"
              title="Millisecond precision"
              size="md"
            />
            <IrisCountdown
              :value="base - 1_000"
              format="HH:mm:ss"
              title="Expired release"
              size="lg"
              @finish="handleExpiredFinish"
            />
          </div>
          <p
            aria-live="polite"
            style="margin: var(--iris-space-md, 16px) 0 0; color: var(--iris-muted)"
          >
            Expired finish callbacks:
            <span data-iris-countdown-finish-count>{{ expiredFinishCount }}</span>
          </p>
        </section>
      </IrisDashboardCard>

      <IrisDashboardCard col-span="full">
        <section
          data-iris-dashboard-section="long-press"
          aria-labelledby="dashboard-long-press-heading"
        >
          <h2
            id="dashboard-long-press-heading"
            style="margin: 0 0 var(--iris-space-xs, 8px); font-size: var(--iris-font-size-lg, 16px)"
          >
            Long press
          </h2>
          <p
            style="
              margin: 0 0 var(--iris-space-md, 16px);
              color: var(--iris-muted);
              font-size: var(--iris-font-size-sm, 13px);
            "
          >
            Release before 100 ms to cancel the hold; each completed hold produces one callback. The
            gesture is uncontrolled, so this readout reports callback results only.
          </p>
          <div
            style="
              display: grid;
              gap: var(--iris-space-md, 16px);
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            "
          >
            <IrisLongPress :hold-delay="100" @longpress="handleLongPress">
              <button
                type="button"
                data-iris-long-press-target="enabled"
                style="
                  display: grid;
                  gap: var(--iris-space-xs, 8px);
                  padding: var(--iris-space-md, 16px);
                  border: 1px solid var(--iris-border);
                  border-radius: var(--iris-radius-md, 6px);
                  background: var(--iris-surface, var(--iris-background));
                  color: var(--iris-foreground);
                  font: inherit;
                  text-align: start;
                  cursor: pointer;
                "
              >
                <strong>Enabled target</strong>
                <span style="color: var(--iris-muted); font-size: var(--iris-font-size-sm, 13px)">
                  Hold for 100 ms to complete.
                </span>
              </button>
            </IrisLongPress>
            <IrisLongPress :hold-delay="100" @longpress="handleLongPress" disabled>
              <button
                type="button"
                data-iris-long-press-target="disabled"
                aria-disabled="true"
                style="
                  display: grid;
                  gap: var(--iris-space-xs, 8px);
                  padding: var(--iris-space-md, 16px);
                  border: 1px dashed var(--iris-border);
                  border-radius: var(--iris-radius-md, 6px);
                  background: var(--iris-background);
                  color: var(--iris-muted);
                  font: inherit;
                  text-align: start;
                  cursor: not-allowed;
                "
              >
                <strong>Disabled target</strong>
                <span style="font-size: var(--iris-font-size-sm, 13px)">
                  Holding does not call back.
                </span>
              </button>
            </IrisLongPress>
          </div>
          <output
            data-iris-long-press-readout
            aria-live="polite"
            style="
              display: block;
              margin: var(--iris-space-md, 16px) 0 0;
              padding: var(--iris-space-sm, 12px) var(--iris-space-md, 16px);
              border: 1px solid var(--iris-border);
              border-radius: var(--iris-radius-md, 6px);
              background: var(--iris-surface, var(--iris-background));
              color: var(--iris-foreground);
              font-size: var(--iris-font-size-sm, 13px);
            "
            >Long-press count: <span data-iris-long-press-count>{{ longPressCount }}</span
            >; Last action:
            <span data-iris-long-press-action>{{ longPressLastAction }}</span></output
          >
        </section>
      </IrisDashboardCard>

      <IrisDashboardCard col-span="full">
        <section
          data-iris-dashboard-section="operations"
          aria-labelledby="dashboard-operations-heading"
        >
          <h2
            id="dashboard-operations-heading"
            style="margin: 0 0 var(--iris-space-xs, 8px); font-size: var(--iris-font-size-lg, 16px)"
          >
            Operations
          </h2>
          <p
            style="
              margin: 0 0 var(--iris-space-md, 16px);
              color: var(--iris-muted);
              font-size: var(--iris-font-size-sm, 13px);
            "
          >
            Use the menu to manage activity and review the loaded feed. Disabled actions remain
            unavailable.
          </p>
          <div style="display: grid; gap: var(--iris-space-md, 16px)">
            <IrisMenu>
              <IrisMenuTrigger
                data-iris-dashboard-menu-trigger
                style="
                  padding: var(--iris-space-xs, 8px) var(--iris-space-md, 16px);
                  border: 1px solid var(--iris-border);
                  border-radius: var(--iris-radius-md, 6px);
                  background: var(--iris-surface);
                  color: var(--iris-foreground);
                  font: inherit;
                  font-size: var(--iris-font-size-sm, 13px);
                  cursor: pointer;
                "
              >
                Operations
              </IrisMenuTrigger>
              <IrisMenuContent data-iris-dashboard-menu>
                <IrisMenuItem @select="handleRefreshActivity">Refresh activity</IrisMenuItem>
                <IrisMenuItem disabled @select="handleExportReport"> Export report </IrisMenuItem>
                <IrisMenuSeparator />
                <IrisMenuSub label="More operations">
                  <IrisMenuItem @select="handleViewAuditLog">View audit log</IrisMenuItem>
                </IrisMenuSub>
              </IrisMenuContent>
            </IrisMenu>

            <IrisScrollArea
              data-iris-dashboard-activity-feed
              role="region"
              aria-label="Activity feed"
              axis="vertical"
              :max-height="180"
              style="
                border: 1px solid var(--iris-border);
                border-radius: var(--iris-radius-md, 6px);
                background: var(--iris-surface);
                color: var(--iris-foreground);
                font-size: var(--iris-font-size-sm, 13px);
              "
            >
              <div
                v-for="activity in operationsActivity"
                :key="activity"
                data-iris-dashboard-activity-row
                style="
                  display: flex;
                  align-items: center;
                  min-height: var(--iris-space-3xl, 48px);
                  padding: var(--iris-space-sm, 8px) var(--iris-space-md, 16px);
                  border-block-end: 1px solid var(--iris-border);
                "
              >
                {{ activity }}
              </div>
            </IrisScrollArea>

            <output
              data-iris-dashboard-action
              aria-live="polite"
              style="
                display: block;
                margin: 0;
                padding: var(--iris-space-sm, 12px) var(--iris-space-md, 16px);
                border: 1px solid var(--iris-border);
                border-radius: var(--iris-radius-md, 6px);
                color: var(--iris-muted);
                font-size: var(--iris-font-size-sm, 13px);
              "
              >Last action: {{ lastAction }}</output
            >
          </div>
        </section>
      </IrisDashboardCard>
    </IrisDashboardGrid>
  </section>
</template>
