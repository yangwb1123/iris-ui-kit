import { defineComponent, h, nextTick, type PropType, type VNode } from 'vue'
import { isClosable, type TabsNav, type TabItem } from '@iris-ui-kit/core'
import { useTabsNav } from './useTabsNav'
import { IrisIcon } from '../primitives/icon/Icon'
import { IrisDropdown } from '../primitives/dropdown/Dropdown'
import { IrisDropdownTrigger } from '../primitives/dropdown/DropdownTrigger'
import { IrisDropdownMenu } from '../primitives/dropdown/DropdownMenu'
import { IrisDropdownItem, IrisDropdownSeparator } from '../primitives/dropdown/DropdownItem'
import { IrisSortable } from '../behaviors/Sortable'
import { useI18n } from '../i18n'

/**
 * Vben-style multi-tab bar over a shared {@link TabsNav} store. Each open page
 * is a closable chip; clicking activates (`@change`), the × closes, and a
 * trailing actions dropdown runs Refresh / Close / Close-others / Close-all on
 * the active tab. The store owns the tab list + active key; the host watches it
 * to sync routing + keep-alive.
 *
 * Keyboard (WAI-ARIA tablist, automatic activation): ←/→ move + activate the
 * adjacent tab, Home/End jump to the first/last, Delete/Backspace closes the
 * focused tab. Roving tabindex keeps a single tab stop.
 */
export const IrisAdminTabs = defineComponent({
  name: 'IrisAdminTabs',
  inheritAttrs: false,
  props: {
    /** Shared tabs store (from `createTabsNav`). */
    nav: { type: Object as PropType<TabsNav>, required: true },
    reorderable: { type: Boolean, default: true },
  },
  emits: {
    change: (_key: string) => true,
    close: (_key: string) => true,
    refresh: (_key: string) => true,
    reorder: (_tabs: TabItem[]) => true,
  },
  setup(props, { emit, attrs }) {
    const { t: tr } = useI18n()
    const t = useTabsNav(props.nav)

    const activate = (key: string): void => {
      props.nav.activate(key)
      emit('change', key)
    }
    const close = (key: string): void => {
      props.nav.close(key)
      emit('close', key)
    }
    const refresh = (key: string): void => {
      props.nav.refresh(key)
      emit('refresh', key)
    }
    const reorder = (tabs: TabItem[]): void => {
      tabs.forEach((tab, index) => props.nav.move(tab.key, index))
      emit('reorder', tabs)
    }

    const focusTab = (root: HTMLElement | null, key: string | undefined): void => {
      if (!root || !key) return
      const labels = root.querySelectorAll<HTMLElement>('[data-iris-tab-label]')
      labels.forEach((el) => {
        if (el.getAttribute('data-key') === key) el.focus()
      })
    }

    const onTablistKeydown = (e: KeyboardEvent): void => {
      const root = e.currentTarget as HTMLElement
      const tabs = t.tabs.value
      const idx = tabs.findIndex((x) => x.key === t.activeKey.value)
      if (idx < 0 || tabs.length === 0) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const cur = tabs[idx]
        if (cur && isClosable(cur)) {
          e.preventDefault()
          close(cur.key)
          void nextTick(() => focusTab(root, props.nav.getState().activeKey))
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
      void nextTick(() => focusTab(root, key))
    }

    const chip = (tab: TabItem): VNode => {
      const active = tab.key === t.activeKey.value
      const closable = isClosable(tab)
      const labelChildren: VNode[] = []
      if (tab.icon) labelChildren.push(h(IrisIcon, { name: tab.icon, size: 14 }))
      labelChildren.push(h('span', { style: { whiteSpace: 'nowrap' } }, tab.title))

      const label = h(
        'button',
        {
          type: 'button',
          role: 'tab',
          'data-iris-tab-label': '',
          'data-key': tab.key,
          'aria-selected': active ? 'true' : 'false',
          'aria-current': active ? 'page' : undefined,
          tabindex: active ? 0 : -1,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '0',
          },
          onClick: () => activate(tab.key),
        },
        labelChildren,
      )

      const closeBtn = closable
        ? h(
            'button',
            {
              type: 'button',
              tabindex: -1,
              'data-iris-tab-close': '',
              'aria-label': tr('admin.closeTab', { title: tab.title }),
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                border: 'none',
                borderRadius: '4px',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                padding: '0',
                opacity: '0.6',
              },
              onClick: (e: Event) => {
                e.stopPropagation()
                close(tab.key)
                const root = (e.currentTarget as HTMLElement).closest(
                  '[role="tablist"]',
                ) as HTMLElement | null
                void nextTick(() => focusTab(root, props.nav.getState().activeKey))
              },
            },
            [h(IrisIcon, { name: 'x', size: 12 })],
          )
        : tab.pinned
          ? h(IrisIcon, { name: 'check-circle', size: 12, style: { opacity: '0.5' } })
          : null

      return h(
        'div',
        {
          key: tab.key,
          'data-iris-tab': '',
          'data-active': active ? 'true' : undefined,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 8px 5px 10px',
            borderRadius: 'var(--iris-radius-md, 6px)',
            border: `1px solid ${active ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
            background: active ? 'var(--iris-primary)' : 'var(--iris-surface)',
            color: active ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
            flex: '0 0 auto',
          },
        },
        [label, closeBtn],
      )
    }

    const action = (label: string, run: () => void, disabled = false): VNode =>
      h(IrisDropdownItem, { disabled, onSelect: run }, { default: () => label })

    const actionsMenu = (): VNode =>
      h(IrisDropdown, null, {
        default: () => [
          h(
            IrisDropdownTrigger,
            { 'aria-label': tr('admin.tabActions') },
            {
              default: () =>
                h(
                  'span',
                  {
                    'data-iris-tab-actions': '',
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--iris-radius-md, 6px)',
                      border: '1px solid var(--iris-border)',
                      background: 'var(--iris-surface)',
                      color: 'var(--iris-foreground)',
                      cursor: 'pointer',
                    },
                  },
                  [h(IrisIcon, { name: 'more-horizontal', size: 16 })],
                ),
            },
          ),
          h(IrisDropdownMenu, null, {
            default: () => {
              const key = t.activeKey.value
              if (!key) return [action('No active tab', () => {}, true)]
              return [
                action(tr('admin.refresh'), () => refresh(key)),
                action(tr('admin.close'), () => close(key)),
                h(IrisDropdownSeparator),
                action(tr('admin.closeLeft'), () => props.nav.closeLeft(key)),
                action(tr('admin.closeRight'), () => props.nav.closeRight(key)),
                action(tr('admin.closeOthers'), () => props.nav.closeOthers(key)),
                action(tr('admin.closeAll'), () => props.nav.closeAll()),
              ]
            },
          }),
        ],
      })

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-admin-tabs': '',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderBottom: '1px solid var(--iris-border)',
            background: 'var(--iris-background)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'div',
            {
              'data-iris-tabs-scroll': '',
              role: 'tablist',
              'aria-label': tr('admin.openPages'),
              onKeydown: onTablistKeydown,
              style: {
                overflowX: 'auto',
                flex: '1',
              },
            },
            [
              h(
                IrisSortable,
                {
                  items: t.tabs.value,
                  getKey: (item: unknown) => (item as TabItem).key,
                  onReorder: (items: unknown[]) => reorder(items as TabItem[]),
                  disabled: !props.reorderable,
                  orientation: 'horizontal',
                  style: {
                    alignItems: 'center',
                    gap: '6px',
                    width: 'max-content',
                  },
                },
                { default: () => t.tabs.value.map((tab) => chip(tab)) },
              ),
            ],
          ),
          actionsMenu(),
        ],
      )
  },
})
