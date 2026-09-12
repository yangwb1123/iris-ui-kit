import { createNotificationCenter } from '@iris-ui-kit/plugin-notifications/vue'

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
