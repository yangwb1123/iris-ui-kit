<script lang="ts">
  import type { NotificationCenter, NotificationCenterState } from '../core'

  let {
    center,
    title = 'Notifications',
    emptyText = 'No notifications',
    dismissLabel = 'Dismiss',
    unreadLabel = '{n} unread',
    markAllReadLabel = 'Mark all read',
    clearLabel = 'Clear',
    class: klass = undefined,
  }: {
    center: NotificationCenter
    /** Panel header text. Default `'Notifications'`. */
    title?: string
    /** Shown when there are no notifications. Default `'No notifications'`. */
    emptyText?: string
    /** Accessible label for the dismiss button. Default `'Dismiss'`. */
    dismissLabel?: string
    /** Accessible label for the unread badge. `{n}` = count. Default `'{n} unread'`. */
    unreadLabel?: string
    /** Label for the mark-all-read action. Default `'Mark all read'`. */
    markAllReadLabel?: string
    /** Label for the clear action. Default `'Clear'`. */
    clearLabel?: string
    class?: string
  } = $props()

  // Bridge the core Store directly (no adapter useStore). NB: do not name this
  // `state` — a leading `$` would make Svelte read `$state` as a store
  // auto-subscription instead of the rune.
  // The effect below owns both the initial sync and subsequent center changes.
  // Starting from the valid empty shape avoids capturing the initial prop in a
  // rune initializer (which Svelte correctly warns would not itself be reactive).
  let centerState: NotificationCenterState = $state({ items: [] })

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
      <span data-iris-notifications-badge aria-label={unreadLabel.replace('{n}', String(unread))}
        >{unread}</span
      >
    {/if}
    <button type="button" data-iris-notifications-mark-all onclick={() => center.markAllRead()}>
      {markAllReadLabel}
    </button>
    <button type="button" data-iris-notifications-clear onclick={() => center.clear()}>
      {clearLabel}
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
            aria-label={dismissLabel}
            onclick={() => center.dismiss(n.id)}
          >
            ×
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
