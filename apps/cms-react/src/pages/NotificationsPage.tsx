import { IrisButton } from '@iris-ui-kit/react'
import { IrisNotificationCenter } from '@iris-ui-kit/plugin-notifications/react'
import { center } from '../notificationCenter'

/**
 * Notifications page — a focused example of the persistent notification-center
 * plugin and its center-backed read, dismiss, clear, and push interactions.
 */
export function NotificationsPage() {
  const pushTestNotification = () => {
    center.push({
      title: 'Test notification pushed',
      description: 'Created from the Notifications page.',
      tone: 'success',
    })
  }

  return (
    <section data-page="notifications" className="notifications-page">
      <h1 className="page-title">Notifications</h1>
      <p className="page-desc">
        A persistent notification-center plugin example. Review unread items, mark them read, or
        push a deterministic test notification into the shared center.
      </p>

      <div className="notifications-demo-action">
        <div>
          <h2>Try a live update</h2>
          <p>Push an item into the center without reloading the page.</p>
        </div>
        <IrisButton type="button" variant="solid" onClick={pushTestNotification}>
          Push test notification
        </IrisButton>
      </div>

      <div className="notifications-panel">
        <IrisNotificationCenter
          center={center}
          title="Notifications"
          emptyText="No notifications"
          dismissLabel="Dismiss"
          markAllReadLabel="Mark all read"
          clearLabel="Clear"
          className="notifications-center"
        />
      </div>
    </section>
  )
}
