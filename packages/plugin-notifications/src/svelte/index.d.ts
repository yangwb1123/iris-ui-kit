export type {
  NotificationCenter,
  NotificationCenterConfig,
  NotificationInput,
  IrisNotification,
  NotificationTone,
  NotificationStorage,
  NotificationStorageSnapshot,
} from '../core/index.js'
export {
  createMemoryNotificationStorage,
  createNotificationCenter,
  notificationsPlugin,
  notificationMessages,
} from '../core/index.js'
import type { SvelteComponent } from 'svelte'
declare const IrisNotificationCenter: typeof SvelteComponent<any>
export default IrisNotificationCenter
