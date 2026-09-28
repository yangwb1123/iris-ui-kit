<script lang="ts">
  import { IrisButton } from '@iris-ui-kit/svelte'
  // The published Svelte barrel's generated declaration omits this named export;
  // its runtime barrel and source contract both expose IrisNotificationCenter.
  // @ts-expect-error — keep the public named import until the package d.ts is regenerated.
  import { IrisNotificationCenter } from '@iris-ui-kit/plugin-notifications/svelte'
  import { center } from '../notificationCenter'

  function pushTestNotification(): void {
    center.push({
      title: 'Test notification pushed',
      description: 'Created from the Notifications page.',
      tone: 'success',
    })
  }
</script>

<section data-page="notifications" class="notifications-page">
  <h1 class="page-title">Notifications</h1>
  <p class="page-desc">
    This page demonstrates read, dismiss, clear, and push behavior with a persistent notification
    center.
  </p>

  <div class="notifications-demo-action">
    <div>
      <h2>Try a live update</h2>
      <p>Push an item into the center without reloading the page.</p>
    </div>
    <IrisButton type="button" variant="solid" onclick={pushTestNotification}>
      Push test notification
    </IrisButton>
  </div>

  <div class="notifications-panel">
    <IrisNotificationCenter
      {center}
      title="Notifications"
      emptyText="No notifications"
      dismissLabel="Dismiss"
      markAllReadLabel="Mark all read"
      clearLabel="Clear"
      class="notifications-center"
    />
  </div>
</section>

<style>
  .notifications-page {
    max-width: 760px;
  }

  .notifications-demo-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--iris-space-sm, 12px);
    flex-wrap: wrap;
    padding: var(--iris-space-md, 16px);
    margin-block-end: var(--iris-space-md, 16px);
    border: 1px solid var(--iris-border);
    border-radius: var(--iris-radius-md, 6px);
    background: var(--iris-surface);
  }

  .notifications-demo-action h2 {
    margin: 0 0 var(--iris-space-xs, 4px);
    font-size: var(--iris-font-size-md, 16px);
  }

  .notifications-demo-action p {
    margin: 0;
    color: var(--iris-muted);
    font-size: var(--iris-font-size-sm, 13px);
  }

  .notifications-panel {
    overflow: hidden;
    border: 1px solid var(--iris-border);
    border-radius: var(--iris-radius-md, 6px);
    background: var(--iris-surface);
  }

  :global(.notifications-center [data-iris-notifications-header]) {
    display: flex;
    align-items: center;
    gap: var(--iris-space-xs, 8px);
    padding: var(--iris-space-sm, 12px) var(--iris-space-md, 16px);
    border-block-end: 1px solid var(--iris-border);
  }

  :global(.notifications-center [data-iris-notifications-title]) {
    margin-inline-end: auto;
    font-weight: 700;
  }

  :global(.notifications-center [data-iris-notifications-badge]) {
    min-width: 22px;
    padding: 2px var(--iris-space-xs, 6px);
    border-radius: 999px;
    background: var(--iris-primary);
    color: var(--iris-primary-foreground, var(--iris-background));
    font-size: var(--iris-font-size-xs, 12px);
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
  }

  :global(.notifications-center [data-iris-notifications-header] button) {
    padding: 5px var(--iris-space-xs, 8px);
    border: 1px solid var(--iris-border);
    border-radius: var(--iris-radius-md, 6px);
    background: var(--iris-background);
    color: var(--iris-foreground);
    font: inherit;
    font-size: var(--iris-font-size-xs, 12px);
    cursor: pointer;
  }

  :global(.notifications-center [data-iris-notifications-list]) {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  :global(.notifications-center [data-iris-notification]) {
    display: flex;
    align-items: flex-start;
    gap: var(--iris-space-xs, 8px);
    padding: var(--iris-space-sm, 14px) var(--iris-space-md, 16px);
    border-block-end: 1px solid var(--iris-border);
  }

  :global(.notifications-center [data-iris-notification]:last-child) {
    border-block-end: 0;
  }

  :global(.notifications-center [data-iris-notification][data-read]) {
    opacity: 0.72;
  }

  :global(.notifications-center [data-iris-notification-body]) {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--iris-space-xs, 4px);
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--iris-foreground);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  :global(.notifications-center [data-iris-notification-title]) {
    font-weight: 600;
  }

  :global(.notifications-center [data-iris-notification-desc]) {
    color: var(--iris-muted);
    font-size: var(--iris-font-size-sm, 13px);
  }

  :global(.notifications-center [data-iris-notification-dismiss]) {
    flex: 0 0 auto;
    padding: 0 var(--iris-space-xxs, 4px);
    border: 0;
    background: transparent;
    color: var(--iris-muted);
    font: inherit;
    font-size: var(--iris-font-size-lg, 18px);
    line-height: 1;
    cursor: pointer;
  }

  :global(.notifications-center [data-iris-notifications-empty]) {
    padding: var(--iris-space-xl, 28px) var(--iris-space-md, 16px);
    color: var(--iris-muted);
    text-align: center;
  }
</style>
