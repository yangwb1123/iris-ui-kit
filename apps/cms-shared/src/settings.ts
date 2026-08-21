import { browserStorage, type KeyValueStorage } from './storage'

export interface CmsSettings {
  siteName: string
  supportEmail: string
  notifications: boolean
  maintenance: boolean
}

export const DEFAULT_CMS_SETTINGS: CmsSettings = {
  siteName: 'Iris CMS',
  supportEmail: 'support@iris.dev',
  notifications: true,
  maintenance: false,
}

export function readCmsSettings(
  storage: KeyValueStorage | undefined = browserStorage(),
  storageKey = 'iris-cms-settings',
): CmsSettings {
  try {
    const raw = storage?.getItem(storageKey)
    if (!raw) return { ...DEFAULT_CMS_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<CmsSettings>
    return {
      siteName:
        typeof parsed.siteName === 'string' ? parsed.siteName : DEFAULT_CMS_SETTINGS.siteName,
      supportEmail:
        typeof parsed.supportEmail === 'string'
          ? parsed.supportEmail
          : DEFAULT_CMS_SETTINGS.supportEmail,
      notifications:
        typeof parsed.notifications === 'boolean'
          ? parsed.notifications
          : DEFAULT_CMS_SETTINGS.notifications,
      maintenance:
        typeof parsed.maintenance === 'boolean'
          ? parsed.maintenance
          : DEFAULT_CMS_SETTINGS.maintenance,
    }
  } catch {
    return { ...DEFAULT_CMS_SETTINGS }
  }
}

export function saveCmsSettings(
  settings: CmsSettings,
  storage: KeyValueStorage | undefined = browserStorage(),
  storageKey = 'iris-cms-settings',
): boolean {
  if (!storage) return false
  try {
    storage.setItem(storageKey, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
