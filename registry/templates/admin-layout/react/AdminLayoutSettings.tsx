import * as React from 'react'
import {
  IrisButton,
  IrisCard,
  useAdminPreferences,
  type AdminPreferences,
  type AdminPreferencesState,
} from '@iris-ui-kit/react'

export interface AdminLayoutSettingsProps {
  preferences: AdminPreferences
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 'var(--iris-spacing-md)',
}

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--iris-spacing-xs)',
  fontSize: 'var(--iris-font-size-sm)',
}

export function AdminLayoutSettings({ preferences }: AdminLayoutSettingsProps): React.ReactElement {
  const { state, set, reset } = useAdminPreferences(preferences, false)
  const select = <K extends keyof AdminPreferencesState>(
    key: K,
    value: AdminPreferencesState[K],
  ): void => set(key, value)

  return (
    <IrisCard data-admin-layout-settings="">
      <div style={gridStyle}>
        <label style={fieldStyle}>
          Navigation
          <select
            value={state.navigationMode}
            onChange={(event) =>
              select(
                'navigationMode',
                event.currentTarget.value as AdminPreferencesState['navigationMode'],
              )
            }
          >
            <option value="sidebar">Sidebar</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </label>
        <label style={fieldStyle}>
          Menu alignment
          <select
            value={state.menuAlign}
            onChange={(event) =>
              select('menuAlign', event.currentTarget.value as AdminPreferencesState['menuAlign'])
            }
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
          </select>
        </label>
        <label style={fieldStyle}>
          Content width
          <select
            value={state.contentWidth}
            onChange={(event) =>
              select(
                'contentWidth',
                event.currentTarget.value as AdminPreferencesState['contentWidth'],
              )
            }
          >
            <option value="fluid">Fluid</option>
            <option value="centered">Centered</option>
          </select>
        </label>
        <label style={fieldStyle}>
          Content height
          <select
            value={state.contentHeight}
            onChange={(event) =>
              select(
                'contentHeight',
                event.currentTarget.value as AdminPreferencesState['contentHeight'],
              )
            }
          >
            <option value="viewport">Viewport</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <label style={fieldStyle}>
          Density
          <select
            value={state.density}
            onChange={(event) =>
              select('density', event.currentTarget.value as AdminPreferencesState['density'])
            }
          >
            <option value="compact">Compact</option>
            <option value="default">Default</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </label>
      </div>
      <div style={{ ...gridStyle, marginBlock: 'var(--iris-spacing-md)' }}>
        {(
          [
            ['showTabs', 'Page tabs'],
            ['showBreadcrumb', 'Breadcrumb'],
            ['stickyHeader', 'Sticky header'],
            ['stickyTabs', 'Sticky tabs'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} style={{ display: 'inline-flex', gap: 'var(--iris-spacing-sm)' }}>
            <input
              type="checkbox"
              checked={state[key]}
              onChange={(event) => select(key, event.currentTarget.checked)}
            />
            {label}
          </label>
        ))}
      </div>
      <IrisButton variant="outline" onClick={reset}>
        Reset layout
      </IrisButton>
    </IrisCard>
  )
}
