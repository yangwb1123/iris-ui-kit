export type {
  NotificationCenter,
  NotificationCenterConfig,
  NotificationInput,
  IrisNotification,
  NotificationTone,
} from '../core/index.js'
export { createNotificationCenter, notificationsPlugin } from '../core/index.js'
import type { SvelteComponent } from 'svelte'
declare const IrisNotificationCenter: typeof SvelteComponent<any>
export default IrisNotificationCenter
