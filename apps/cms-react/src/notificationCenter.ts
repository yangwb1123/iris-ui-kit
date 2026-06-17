/**
 * Global notification center for the CMS React demo.
 * Created once (module-level singleton), shared by the CRUD pages (push)
 * and the shell (IrisNotificationCenter reads from it).
 */
import { createNotificationCenter } from '@iris-ui/plugin-notifications/react'

export const center = createNotificationCenter({ max: 30 })
