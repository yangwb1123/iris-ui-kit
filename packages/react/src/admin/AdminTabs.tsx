import * as React from 'react'
import { isClosable, type TabsNav, type TabItem } from '@iris-ui/core'
import { useTabsNav } from './useTabsNav'
import { IrisIcon } from '../primitives/icon/Icon'
import { IrisDropdown } from '../primitives/dropdown/Dropdown'
import { IrisDropdownTrigger } from '../primitives/dropdown/DropdownTrigger'
import { IrisDropdownMenu } from '../primitives/dropdown/DropdownMenu'
import { IrisDropdownItem, IrisDropdownSeparator } from '../primitives/dropdown/DropdownItem'
import { useI18n } from '../i18n'

export interface IrisAdminTabsProps {
  /** Shared tabs store (from `createTabsNav`). */
  nav: TabsNav
  onChange?: (key: string) => void
  onClose?: (key: string) => void
  onRefresh?: (key: string) => void
}

/**
 * Vben-style multi-tab bar over a shared {@link TabsNav} store. Each open page is
 * a closable chip; clicking activates (`onChange`), the × closes, and a trailing
 * actions dropdown runs Refresh / Close / Close-others / Close-all on the active
 * tab. The store owns the tab list + active key; the host watches it to sync
 * routing + keep-alive.
 *
 * Keyboard (WAI-ARIA tablist, automatic activation): ←/→ move + activate, Home/
 * End jump, Delete/Backspace closes the focused tab. Roving tabindex keeps a
 * single tab stop. React port of the Vue `IrisAdminTabs`.
 */
export function IrisAdminTabs({
  nav,
  onChange,
  onClose,
  onRefresh,
}: IrisAdminTabsProps): React.ReactElement {
  const t = useTabsNav(nav)
  const { t: translate } = useI18n()
  const tablistRef = React.useRef<HTMLDivElement>(null)
  const pendingFocus = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!pendingFocus.current) return
    const key = pendingFocus.current
    pendingFocus.current = null
    tablistRef.current?.querySelectorAll<HTMLElement>('[data-iris-tab-label]').forEach((el) => {
      if (el.getAttribute('data-key') === key) el.focus()
    })
  })

  const activate = (key: string): void => {
    nav.activate(key)
    onChange?.(key)
  }
  const close = (key: string): void => {
    nav.close(key)
    onClose?.(key)
  }
  const refresh = (key: string): void => {
    nav.refresh(key)
    onRefresh?.(key)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const tabs = t.tabs
    const idx = tabs.findIndex((x) => x.key === t.activeKey)
    if (idx < 0 || tabs.length === 0) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const cur = tabs[idx]
      if (cur && isClosable(cur)) {
        e.preventDefault()
        close(cur.key)
        pendingFocus.current = nav.getState().activeKey ?? null
      }
      return
    }

    let target = -1
    if (e.key === 'ArrowRight') target = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft') target = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') target = 0
    else if (e.key === 'End') target = tabs.length - 1
    else return

    e.preventDefault()
    const key = tabs[target]?.key
    if (!key) return
    activate(key)
    pendingFocus.current = key
  }

  const chip = (tab: TabItem): React.ReactElement => {
    const active = tab.key === t.activeKey
    const closable = isClosable(tab)

    const label = (
      <button
        type="button"
        role="tab"
        data-iris-tab-label=""
        data-key={tab.key}
        aria-selected={active ? 'true' : 'false'}
        aria-current={active ? 'page' : undefined}
        tabIndex={active ? 0 : -1}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          fontSize: 13,
          cursor: 'pointer',
          padding: 0,
        }}
        onClick={() => activate(tab.key)}
      >
        {tab.icon ? <IrisIcon name={tab.icon} size={14} /> : null}
        <span style={{ whiteSpace: 'nowrap' }}>{tab.title}</span>
      </button>
    )

    const closeBtn = closable ? (
      <button
        type="button"
        tabIndex={-1}
        data-iris-tab-close=""
        aria-label={translate('admin.closeTab', { title: tab.title })}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          border: 'none',
          borderRadius: 4,
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          padding: 0,
          opacity: 0.6,
        }}
        onClick={(e) => {
          e.stopPropagation()
          close(tab.key)
        }}
      >
        <IrisIcon name="x" size={12} />
      </button>
    ) : tab.pinned ? (
      <IrisIcon name="check-circle" size={12} style={{ opacity: 0.5 }} />
    ) : null

    return (
      <div
        key={tab.key}
        data-iris-tab=""
        data-active={active ? 'true' : undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 8px 5px 10px',
          borderRadius: 'var(--iris-radius-md, 6px)',
          border: `1px solid ${active ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
          background: active ? 'var(--iris-primary)' : 'var(--iris-surface)',
          color: active ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
          flex: '0 0 auto',
        }}
      >
        {label}
        {closeBtn}
      </div>
    )
  }

  const activeKey = t.activeKey
  return (
    <div
      data-iris-admin-tabs=""
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderBottom: '1px solid var(--iris-border)',
        background: 'var(--iris-background)',
      }}
    >
      <div
        ref={tablistRef}
        data-iris-tabs-scroll=""
        role="tablist"
        aria-label={translate('admin.openPages')}
        onKeyDown={onKeyDown}
        style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', flex: 1 }}
      >
        {t.tabs.map((tab) => chip(tab))}
      </div>

      <IrisDropdown>
        <IrisDropdownTrigger
          aria-label={translate('admin.tabActions')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 'var(--iris-radius-md, 6px)',
            border: '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            cursor: 'pointer',
          }}
        >
          <IrisIcon name="more-horizontal" size={16} />
        </IrisDropdownTrigger>
        <IrisDropdownMenu>
          {activeKey ? (
            <>
              <IrisDropdownItem onSelect={() => refresh(activeKey)}>
                {translate('admin.refresh')}
              </IrisDropdownItem>
              <IrisDropdownItem onSelect={() => close(activeKey)}>
                {translate('admin.close')}
              </IrisDropdownItem>
              <IrisDropdownSeparator />
              <IrisDropdownItem onSelect={() => nav.closeOthers(activeKey)}>
                {translate('admin.closeOthers')}
              </IrisDropdownItem>
              <IrisDropdownItem onSelect={() => nav.closeAll()}>
                {translate('admin.closeAll')}
              </IrisDropdownItem>
            </>
          ) : (
            <IrisDropdownItem disabled>No active tab</IrisDropdownItem>
          )}
        </IrisDropdownMenu>
      </IrisDropdown>
    </div>
  )
}
