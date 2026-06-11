export { default as IrisNotificationCenter } from './IrisNotificationCenter.svelte'

export type {
  NotificationCenter,
  NotificationCenterConfig,
  NotificationInput,
  IrisNotification,
  NotificationTone,
} from '../core'
export { createNotificationCenter, notificationsPlugin } from '../core'
