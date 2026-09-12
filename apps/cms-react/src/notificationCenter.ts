/**
 * Global notification center for the CMS React demo.
 * Created once (module-level singleton) so the Notifications page and its
 * IrisNotificationCenter share state while navigating between CMS tabs.
 */
import { createNotificationCenter } from '@iris-ui-kit/plugin-notifications/react'

export const center = createNotificationCenter({
  max: 30,
  initial: [
    {
      title: 'Weekly analytics report ready',
      description: 'Review the latest CMS activity summary.',
      tone: 'info',
    },
    {
      title: 'Content review needed',
      description: 'Two articles are waiting for approval.',
      tone: 'warning',
    },
  ],
})
