<script lang="ts">
  import {
    IrisDashboardGrid,
    IrisDashboardCard,
    IrisBadge,
    IrisCountdown,
  } from '@iris-ui-kit/svelte'
  import type { IrisBadgeTone } from '@iris-ui-kit/svelte'

  const stats: { label: string; value: string; delta: string; tone: IrisBadgeTone }[] = [
    { label: 'Total users', value: '12,480', delta: '+4.2%', tone: 'primary' },
    { label: 'Articles', value: '3,914', delta: '+1.1%', tone: 'success' },
    { label: 'Open tickets', value: '57', delta: '-12%', tone: 'warning' },
    { label: 'Errors (24h)', value: '3', delta: '-2', tone: 'danger' },
  ]

  const base = Date.now()
  let expiredFinishCount = $state(0)

  function handleExpiredFinish(): void {
    expiredFinishCount += 1
  }
</script>

<section>
  <h1 class="page-title">Dashboard</h1>
  <p class="page-desc">
    Built entirely from existing Iris components — IrisDashboardGrid + Card, Badge — inside the
    IrisAdminLayout shell. Switch skins from the header to re-theme everything through tokens.
  </p>
  <IrisDashboardGrid columns={12} gap={16}>
    {#each stats as s (s.label)}
      <IrisDashboardCard colSpan={3}>
        <div class="stat-label">{s.label}</div>
        <div class="stat-value">{s.value}</div>
        <IrisBadge tone={s.tone} variant="subtle">{s.delta}</IrisBadge>
      </IrisDashboardCard>
    {/each}
    <IrisDashboardCard colSpan="full">
      <div class="stat-label">Welcome back 👋</div>
      <p style="margin: 8px 0 0; max-width: 70ch; line-height: 1.6">
        This is a Vben-style CMS shell assembled from <code>@iris-ui-kit/svelte</code>: a
        data-driven collapsible sidebar nav, a header breadcrumb, and a keep-alive multi-tab bar —
        all driven by one nav-tree config and the framework-agnostic stores in
        <code>@iris-ui-kit/core</code> (the same core that powers the React, Vue, and Solid versions).
      </p>
    </IrisDashboardCard>

    <IrisDashboardCard colSpan="full">
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
            onfinish={handleExpiredFinish}
          />
        </div>
        <p
          aria-live="polite"
          style="margin: var(--iris-space-md, 16px) 0 0; color: var(--iris-muted)"
        >
          Expired finish callbacks:
          <span data-iris-countdown-finish-count>{expiredFinishCount}</span>
        </p>
      </section>
    </IrisDashboardCard>
  </IrisDashboardGrid>
</section>
