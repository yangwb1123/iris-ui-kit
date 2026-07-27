import { For, type JSX } from 'solid-js'
import {
  IrisButton,
  IrisCard,
  useAdminPreferences,
  type AdminPreferences,
  type AdminPreferencesState,
} from '@iris-ui-kit/solid'

export interface AdminLayoutSettingsProps {
  preferences: AdminPreferences
}

export function AdminLayoutSettings(props: AdminLayoutSettingsProps): JSX.Element {
  const preferences = useAdminPreferences(props.preferences, false)
  const state = preferences.state
  const toggles = [
    ['showTabs', 'Page tabs'],
    ['showBreadcrumb', 'Breadcrumb'],
    ['stickyHeader', 'Sticky header'],
    ['stickyTabs', 'Sticky tabs'],
  ] as const
  return (
    <IrisCard data-admin-layout-settings="">
      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--iris-spacing-md)',
        }}
      >
        <label>
          Navigation
          <select
            value={state().navigationMode}
            onChange={(event) =>
              preferences.set(
                'navigationMode',
                event.currentTarget.value as AdminPreferencesState['navigationMode'],
              )
            }
          >
            <option value="sidebar">Sidebar</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </label>
        <label>
          Menu alignment
          <select
            value={state().menuAlign}
            onChange={(event) =>
              preferences.set(
                'menuAlign',
                event.currentTarget.value as AdminPreferencesState['menuAlign'],
              )
            }
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
          </select>
        </label>
        <label>
          Content width
          <select
            value={state().contentWidth}
            onChange={(event) =>
              preferences.set(
                'contentWidth',
                event.currentTarget.value as AdminPreferencesState['contentWidth'],
              )
            }
          >
            <option value="fluid">Fluid</option>
            <option value="centered">Centered</option>
          </select>
        </label>
        <label>
          Content height
          <select
            value={state().contentHeight}
            onChange={(event) =>
              preferences.set(
                'contentHeight',
                event.currentTarget.value as AdminPreferencesState['contentHeight'],
              )
            }
          >
            <option value="viewport">Viewport</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <label>
          Density
          <select
            value={state().density}
            onChange={(event) =>
              preferences.set(
                'density',
                event.currentTarget.value as AdminPreferencesState['density'],
              )
            }
          >
            <option value="compact">Compact</option>
            <option value="default">Default</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </label>
      </div>
      <div
        style={{
          display: 'flex',
          'flex-wrap': 'wrap',
          gap: 'var(--iris-spacing-md)',
          margin: 'var(--iris-spacing-md) 0',
        }}
      >
        <For each={toggles}>
          {([key, label]) => (
            <label style={{ display: 'inline-flex', gap: 'var(--iris-spacing-sm)' }}>
              <input
                type="checkbox"
                checked={state()[key]}
                onChange={(event) => preferences.set(key, event.currentTarget.checked)}
              />
              {label}
            </label>
          )}
        </For>
      </div>
      <IrisButton variant="outline" onClick={preferences.reset}>
        Reset layout
      </IrisButton>
    </IrisCard>
  )
}
