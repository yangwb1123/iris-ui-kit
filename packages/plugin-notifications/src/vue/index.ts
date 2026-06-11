import {
  defineComponent,
  h,
  onMounted,
  onScopeDispose,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import type { NotificationCenter, NotificationCenterState } from '../core'

export type {
  NotificationCenter,
  NotificationCenterConfig,
  NotificationInput,
  IrisNotification,
  NotificationTone,
} from '../core'
export { createNotificationCenter, notificationsPlugin } from '../core'

/**
 * Notification-center panel for Vue (render-function authored to match the
 * `@iris-ui/vue` convention): a header (title + unread badge + mark-all /
 * clear) over a list of notifications (click to mark read, × to dismiss). All
 * state lives in the {@link NotificationCenter}; the host wraps this in a
 * popover / drawer behind a bell icon. The core Store is bridged directly via a
 * `shallowRef` — no adapter `useStore` — so the plugin only depends on
 * `@iris-ui/core`.
 */
export const IrisNotificationCenter = defineComponent({
  name: 'IrisNotificationCenter',
  props: {
    center: { type: Object as PropType<NotificationCenter>, required: true },
    /** Panel header text. Default `'Notifications'`. */
    title: { type: String, default: 'Notifications' },
    /** Shown when there are no notifications. Default `'No notifications'`. */
    emptyText: { type: String, default: 'No notifications' },
    className: { type: String, default: undefined },
  },
  setup(props) {
    const { center } = props
    const state = shallowRef<NotificationCenterState>(center.store.getState())
    onMounted(() => {
      const unsub = center.store.subscribe((s) => {
        state.value = s
      })
      onScopeDispose(unsub)
    })

    return () => {
      const items = state.value.items
      const unread = items.filter((n) => !n.read).length

      const headerChildren: VNode[] = [
        h('span', { 'data-iris-notifications-title': '' }, props.title),
      ]
      if (unread > 0) {
        headerChildren.push(
          h(
            'span',
            { 'data-iris-notifications-badge': '', 'aria-label': `${unread} unread` },
            String(unread),
          ),
        )
      }
      headerChildren.push(
        h(
          'button',
          {
            type: 'button',
            'data-iris-notifications-mark-all': '',
            onClick: () => center.markAllRead(),
          },
          'Mark all read',
        ),
        h(
          'button',
          {
            type: 'button',
            'data-iris-notifications-clear': '',
            onClick: () => center.clear(),
          },
          'Clear',
        ),
      )

      const body: VNode =
        items.length === 0
          ? h('div', { 'data-iris-notifications-empty': '' }, props.emptyText)
          : h(
              'ul',
              { 'data-iris-notifications-list': '', role: 'list' },
              items.map((n) => {
                const bodyChildren: VNode[] = [
                  h('span', { 'data-iris-notification-title': '' }, n.title),
                ]
                if (n.description) {
                  bodyChildren.push(h('span', { 'data-iris-notification-desc': '' }, n.description))
                }
                return h(
                  'li',
                  {
                    key: n.id,
                    'data-iris-notification': '',
                    'data-tone': n.tone,
                    'data-read': n.read ? '' : undefined,
                  },
                  [
                    h(
                      'button',
                      {
                        type: 'button',
                        'data-iris-notification-body': '',
                        onClick: () => center.markRead(n.id),
                      },
                      bodyChildren,
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        'data-iris-notification-dismiss': '',
                        'aria-label': 'Dismiss',
                        onClick: () => center.dismiss(n.id),
                      },
                      '×',
                    ),
                  ],
                )
              }),
            )

      return h('div', { 'data-iris-notifications': '', class: props.className }, [
        h('div', { 'data-iris-notifications-header': '' }, headerChildren),
        body,
      ])
    }
  },
})
