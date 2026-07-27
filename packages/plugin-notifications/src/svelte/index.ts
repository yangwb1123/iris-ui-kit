export { default as IrisNotificationCenter } from './IrisNotificationCenter.svelte'

export type {
  NotificationCenter,
  NotificationCenterConfig,
  NotificationInput,
  IrisNotification,
  NotificationTone,
  NotificationStorage,
  NotificationStorageSnapshot,
} from '../core'
export {
  createMemoryNotificationStorage,
  createNotificationCenter,
  notificationsPlugin,
  notificationMessages,
} from '../core'
