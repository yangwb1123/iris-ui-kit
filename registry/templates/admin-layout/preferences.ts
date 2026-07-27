import {
  createAdminPreferences,
  createTabsNav,
  localStorageAdminPreferencesStorage,
  type TabItem,
} from '@iris-ui-kit/core'

/** Persistent chrome preferences for the installed admin layout. */
export function createAdminLayoutPreferences(storageKey = 'admin-layout-preferences') {
  return createAdminPreferences({
    storage: localStorageAdminPreferencesStorage(storageKey),
  })
}

/** Consumer-owned tab controller; route components stay statically imported. */
export function createAdminLayoutTabs(home: TabItem = { key: '/', title: 'Home', pinned: true }) {
  return createTabsNav({ tabs: [home], activeKey: home.key })
}
