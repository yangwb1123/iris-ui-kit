<script lang="ts">
  import type { NotificationCenter, NotificationCenterState } from '../core'

  let {
    center,
    title = 'Notifications',
    emptyText = 'No notifications',
    class: klass = undefined,
  }: {
    center: NotificationCenter
    /** Panel header text. Default `'Notifications'`. */
    title?: string
    /** Shown when there are no notifications. Default `'No notifications'`. */
    emptyText?: string
    class?: string
  } = $props()

  // Bridge the core Store directly (no adapter useStore). NB: do not name this
  // `state` — a leading `$` would make Svelte read `$state` as a store
  // auto-subscription instead of the rune.
  let centerState: NotificationCenterState = $state(center.getState())

  $effect(() => {
    // Re-sync (and re-subscribe) whenever the bound center changes.
    centerState = center.getState()
    return center.store.subscribe((s) => (centerState = s))
  })

  const unread = $derived(centerState.items.filter((n) => !n.read).length)
</script>

<div data-iris-notifications class={klass}>
  <div data-iris-notifications-header>
    <span data-iris-notifications-title>{title}</span>
    {#if unread > 0}
      <span data-iris-notifications-badge aria-label={`${unread} unread`}>{unread}</span>
    {/if}
    <button type="button" data-iris-notifications-mark-all onclick={() => center.markAllRead()}>
      Mark all read
    </button>
    <button type="button" data-iris-notifications-clear onclick={() => center.clear()}>
      Clear
    </button>
  </div>
  {#if centerState.items.length === 0}
    <div data-iris-notifications-empty>{emptyText}</div>
  {:else}
    <ul data-iris-notifications-list role="list">
      {#each centerState.items as n (n.id)}
        <li data-iris-notification data-tone={n.tone} data-read={n.read ? '' : undefined}>
          <button type="button" data-iris-notification-body onclick={() => center.markRead(n.id)}>
            <span data-iris-notification-title>{n.title}</span>
            {#if n.description}
              <span data-iris-notification-desc>{n.description}</span>
            {/if}
          </button>
          <button
            type="button"
            data-iris-notification-dismiss
            aria-label="Dismiss"
            onclick={() => center.dismiss(n.id)}
          >
            ×
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
