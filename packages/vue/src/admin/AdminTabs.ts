import { defineComponent, h, type PropType, type VNode } from 'vue'
import type { TabsNav, TabItem } from '@iris-ui/core'
import { useTabsNav } from './useTabsNav'
import { IrisIcon } from '../primitives/icon/Icon'
import { IrisDropdown } from '../primitives/dropdown/Dropdown'
import { IrisDropdownTrigger } from '../primitives/dropdown/DropdownTrigger'
import { IrisDropdownMenu } from '../primitives/dropdown/DropdownMenu'
import { IrisDropdownItem, IrisDropdownSeparator } from '../primitives/dropdown/DropdownItem'

/**
 * Vben-style multi-tab bar over a shared {@link TabsNav} store. Each open page
 * is a closable chip; clicking activates (`@change`), the × closes, and a
 * trailing actions dropdown runs Refresh / Close / Close-others / Close-all on
 * the active tab. The store owns the tab list + active key; the host watches it
 * to sync routing + keep-alive.
 */
export const IrisAdminTabs = defineComponent({
  name: 'IrisAdminTabs',
  inheritAttrs: false,
  props: {
    /** Shared tabs store (from `createTabsNav`). */
    nav: { type: Object as PropType<TabsNav>, required: true },
  },
  emits: {
    change: (_key: string) => true,
    close: (_key: string) => true,
    refresh: (_key: string) => true,
  },
  setup(props, { emit, attrs }) {
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

    const isClosable = (tab: TabItem): boolean => !tab.pinned && tab.closable !== false

    const chip = (tab: TabItem): VNode => {
      const active = tab.key === t.activeKey.value
      const closable = isClosable(tab)
      const children: VNode[] = []
      if (tab.icon) children.push(h(IrisIcon, { name: tab.icon, size: 14 }))
      children.push(h('span', { style: { whiteSpace: 'nowrap' } }, tab.title))

      const label = h(
        'button',
        {
          type: 'button',
          'data-iris-tab-label': '',
          'aria-current': active ? 'page' : undefined,
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
        children,
      )

      const closeBtn = closable
        ? h(
            'button',
            {
              type: 'button',
              'data-iris-tab-close': '',
              'aria-label': `Close ${tab.title}`,
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
          role: 'tab',
          'aria-selected': active ? 'true' : 'false',
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
            { 'aria-label': 'Tab actions' },
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
                action('Refresh', () => refresh(key)),
                action('Close', () => close(key)),
                h(IrisDropdownSeparator),
                action('Close others', () => props.nav.closeOthers(key)),
                action('Close all', () => props.nav.closeAll()),
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
          role: 'tablist',
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
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflowX: 'auto',
                flex: '1',
              },
            },
            t.tabs.value.map((tab) => chip(tab)),
          ),
          actionsMenu(),
        ],
      )
  },
})
