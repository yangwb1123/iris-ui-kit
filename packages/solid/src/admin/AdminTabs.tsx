import { For, Show, type JSX } from 'solid-js'
import {
  adminChromePx,
  adminTabsChrome,
  isClosable,
  type AdminChromeSize,
  type TabsNav,
  type TabItem,
} from '@iris-ui-kit/core'
import { useTabsNav } from './useTabsNav'
import { useComponentSize } from '../provider'
import { IrisIcon } from '../primitives/icon/Icon'
import { IrisDropdown } from '../primitives/dropdown/Dropdown'
import { IrisDropdownTrigger } from '../primitives/dropdown/DropdownTrigger'
import { IrisDropdownMenu } from '../primitives/dropdown/DropdownMenu'
import { IrisDropdownItem, IrisDropdownSeparator } from '../primitives/dropdown/DropdownItem'
import { IrisSortable } from '../behaviors/IrisSortable'
import { useI18n } from '../i18n'

export interface IrisAdminTabsProps {
  /** Shared tabs store (from `createTabsNav`). */
  nav: TabsNav
  onChange?: (key: string) => void
  onClose?: (key: string) => void
  onRefresh?: (key: string) => void
  /** Enable pointer/touch reordering. */
  reorderable?: boolean
  onReorder?: (tabs: TabItem[]) => void
  /**
   * Bounded bar / chip geometry (`md` = the default, so omitting it keeps the
   * pre-`size` look). Resolved in core — this component only bridges the
   * numbers into inline styles.
   */
  size?: AdminChromeSize
}

/**
 * Vben-style multi-tab bar over a shared {@link TabsNav}. Closable chips with
 * active highlight, pinned tabs without a ×, a trailing actions dropdown
 * (Refresh / Close / Close-others / Close-all), and the full WAI-ARIA tablist
 * keyboard (←/→/Home/End/Delete + roving tabindex). Solid port of React/Vue.
 */
export function IrisAdminTabs(props: IrisAdminTabsProps): JSX.Element {
  const t = useTabsNav(props.nav)
  const { t: translate } = useI18n()
  // Bar / chip geometry for the requested tier — one core table, bridged below.
  const size = useComponentSize(() => props.size)
  const chrome = () => adminTabsChrome(size())
  let tablistEl: HTMLDivElement | undefined
  let pendingFocus: string | null = null

  const focusPending = (): void => {
    if (!pendingFocus || !tablistEl) return
    const key = pendingFocus
    pendingFocus = null
    tablistEl.querySelectorAll<HTMLElement>('[data-iris-tab-label]').forEach((el) => {
      if (el.getAttribute('data-key') === key) el.focus()
    })
  }

  const activate = (key: string): void => {
    props.nav.activate(key)
    props.onChange?.(key)
  }
  const close = (key: string): void => {
    props.nav.close(key)
    props.onClose?.(key)
  }
  const refresh = (key: string): void => {
    props.nav.refresh(key)
    props.onRefresh?.(key)
  }
  const reorder = (tabs: TabItem[]): void => {
    tabs.forEach((tab, index) => props.nav.move(tab.key, index))
    props.onReorder?.(tabs)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    const tabs = t.tabs()
    const idx = tabs.findIndex((x) => x.key === t.activeKey())
    if (idx < 0 || tabs.length === 0) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const cur = tabs[idx]
      if (cur && isClosable(cur)) {
        e.preventDefault()
        close(cur.key)
        pendingFocus = props.nav.getState().activeKey ?? null
        queueMicrotask(focusPending)
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
    pendingFocus = key
    queueMicrotask(focusPending)
  }

  const chip = (tab: TabItem): JSX.Element => {
    const active = (): boolean => tab.key === t.activeKey()
    const closable = isClosable(tab)
    return (
      <div
        data-iris-tab=""
        data-active={active() ? 'true' : undefined}
        style={{
          display: 'inline-flex',
          'align-items': 'center',
          gap: adminChromePx(chrome().chipGap),
          'box-sizing': 'border-box',
          // A floor, never a clip: a larger font grows the chip.
          'min-height': adminChromePx(chrome().chipMinHeight),
          'padding-block': adminChromePx(chrome().chipPaddingBlock),
          'padding-inline-start': adminChromePx(chrome().chipPaddingInlineStart),
          'padding-inline-end': adminChromePx(chrome().chipPaddingInlineEnd),
          'border-radius': 'var(--iris-radius-md, 6px)',
          border: `1px solid ${active() ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
          background: active() ? 'var(--iris-primary)' : 'var(--iris-surface)',
          color: active() ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
          flex: '0 0 auto',
        }}
      >
        <button
          type="button"
          role="tab"
          data-iris-tab-label=""
          data-key={tab.key}
          aria-selected={active() ? 'true' : 'false'}
          aria-current={active() ? 'page' : undefined}
          tabindex={active() ? 0 : -1}
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            gap: adminChromePx(chrome().labelGap),
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            'font-size': chrome().labelFontSize,
            cursor: 'pointer',
            padding: 0,
          }}
          onClick={() => activate(tab.key)}
        >
          <Show when={tab.icon}>
            <IrisIcon name={tab.icon!} size={chrome().tabIconSize} />
          </Show>
          <span style={{ 'white-space': 'nowrap' }}>{tab.title}</span>
        </button>
        <Show
          when={closable}
          fallback={
            <Show when={tab.pinned}>
              <IrisIcon
                name="check-circle"
                size={chrome().closeIconSize}
                style={{ opacity: '0.5' }}
              />
            </Show>
          }
        >
          <button
            type="button"
            tabindex={-1}
            data-iris-tab-close=""
            aria-label={translate('admin.closeTab', { title: tab.title })}
            style={{
              display: 'inline-flex',
              'align-items': 'center',
              'justify-content': 'center',
              'box-sizing': 'border-box',
              width: adminChromePx(chrome().closeSize),
              height: adminChromePx(chrome().closeSize),
              border: 'none',
              'border-radius': 'var(--iris-radius-sm, 4px)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              opacity: '0.6',
            }}
            onClick={(e) => {
              e.stopPropagation()
              close(tab.key)
            }}
          >
            <IrisIcon name="x" size={chrome().closeIconSize} />
          </button>
        </Show>
      </div>
    )
  }

  return (
    <div
      data-iris-admin-tabs=""
      data-iris-size={props.size ?? (size() === 'md' ? undefined : size())}
      style={{
        display: 'flex',
        'align-items': 'center',
        'box-sizing': 'border-box',
        'min-width': adminChromePx(chrome().barMinWidth),
        'min-height': adminChromePx(chrome().barMinHeight),
        gap: adminChromePx(chrome().barGap),
        'padding-block': adminChromePx(chrome().barPaddingBlock),
        'padding-inline': adminChromePx(chrome().barPaddingInline),
        'border-bottom': '1px solid var(--iris-border)',
        background: 'var(--iris-background)',
      }}
    >
      <div
        ref={tablistEl}
        data-iris-tabs-scroll=""
        role="tablist"
        aria-label={translate('admin.openPages')}
        onKeyDown={onKeyDown}
        style={{
          'min-width': adminChromePx(chrome().scrollMinWidth),
          'overflow-x': 'auto',
          flex: 1,
        }}
      >
        <IrisSortable
          items={t.tabs()}
          getKey={(tab) => tab.key}
          onReorder={reorder}
          disabled={props.reorderable === false}
          orientation="horizontal"
          style={{
            'align-items': 'center',
            gap: 'var(--iris-space-xs, 8px)',
            width: 'max-content',
          }}
        >
          <For each={t.tabs()}>{(tab) => chip(tab)}</For>
        </IrisSortable>
      </div>

      <IrisDropdown>
        <IrisDropdownTrigger
          aria-label={translate('admin.tabActions')}
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'center',
            'box-sizing': 'border-box',
            width: adminChromePx(chrome().actionsSize),
            height: adminChromePx(chrome().actionsSize),
            'border-radius': 'var(--iris-radius-md, 6px)',
            border: '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            cursor: 'pointer',
          }}
        >
          <IrisIcon name="more-horizontal" size={chrome().actionsIconSize} />
        </IrisDropdownTrigger>
        <IrisDropdownMenu>
          <Show
            when={t.activeKey()}
            fallback={
              <IrisDropdownItem disabled>{translate('admin.noActiveTab')}</IrisDropdownItem>
            }
          >
            {(key) => (
              <>
                <IrisDropdownItem onSelect={() => refresh(key())}>
                  {translate('admin.refresh')}
                </IrisDropdownItem>
                <IrisDropdownItem onSelect={() => close(key())}>
                  {translate('admin.close')}
                </IrisDropdownItem>
                <IrisDropdownSeparator />
                <IrisDropdownItem onSelect={() => props.nav.closeLeft(key())}>
                  {translate('admin.closeLeft')}
                </IrisDropdownItem>
                <IrisDropdownItem onSelect={() => props.nav.closeRight(key())}>
                  {translate('admin.closeRight')}
                </IrisDropdownItem>
                <IrisDropdownItem onSelect={() => props.nav.closeOthers(key())}>
                  {translate('admin.closeOthers')}
                </IrisDropdownItem>
                <IrisDropdownItem onSelect={() => props.nav.closeAll()}>
                  {translate('admin.closeAll')}
                </IrisDropdownItem>
              </>
            )}
          </Show>
        </IrisDropdownMenu>
      </IrisDropdown>
    </div>
  )
}
