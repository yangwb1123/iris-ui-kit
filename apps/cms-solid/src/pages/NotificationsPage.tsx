import { IrisButton } from '@iris-ui-kit/solid'
import { IrisNotificationCenter } from '@iris-ui-kit/plugin-notifications/solid'
import { center } from '../notificationCenter'

/**
 * Notifications page — a focused example of the persistent notification-center
 * plugin and its center-backed read, dismiss, clear, and push interactions.
 */
export function NotificationsPage() {
  const pushTestNotification = (): void => {
    center.push({
      title: 'Test notification pushed',
      description: 'Created from the Notifications page.',
      tone: 'success',
    })
  }

  return (
    <section data-page="notifications" class="notifications-page">
      <h1 class="page-title">Notifications</h1>
      <p class="page-desc">
        A persistent notification-center plugin example with live updates. Review unread items, mark
        them read, or push a test notification into the shared center.
      </p>

      <div class="notifications-demo-action">
        <div>
          <h2>Try a live update</h2>
          <p>Push an item into the center without reloading the page.</p>
        </div>
        <IrisButton type="button" variant="solid" onClick={pushTestNotification}>
          Push test notification
        </IrisButton>
      </div>

      <div class="notifications-panel">
        <IrisNotificationCenter
          center={center}
          title="Notifications"
          emptyText="No notifications"
          dismissLabel="Dismiss"
          markAllReadLabel="Mark all read"
          clearLabel="Clear"
          class="notifications-center"
        />
      </div>
    </section>
  )
}
