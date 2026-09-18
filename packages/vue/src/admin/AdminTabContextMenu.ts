import {
  Teleport,
  computed,
  h,
  nextTick,
  onScopeDispose,
  ref,
  watch,
  type ComputedRef,
  type VNode,
} from 'vue'
import { isClosable, nextEnabledIndex, type TabItem } from '@iris-ui-kit/core'
import type { UseI18nReturn } from '../i18n'
import { useDismiss } from '../primitives/floating/useDismiss'
import { useFloating } from '../primitives/floating/useFloating'
import { IrisIcon } from '../primitives/icon/Icon'

type Translate = UseI18nReturn['t']

export type TabAction =
  | 'refresh'
  | 'close'
  | 'closeLeft'
  | 'closeRight'
  | 'closeOthers'
  | 'closeAll'

type TabContextMenuActionEntry = {
  key: TabAction
  label: string
  icon: string
  disabled?: boolean
}

type TabContextMenuEntry = TabContextMenuActionEntry | { key: 'separator'; separator: true }

export interface AdminTabContextMenuOptions {
  tabs: ComputedRef<TabItem[]>
  t: Translate
  onAction: (key: string, action: TabAction) => void
}

export interface AdminTabContextMenu {
  open: (event: MouseEvent, key: string) => void
  render: () => VNode | null
}

const isActionEntry = (entry: TabContextMenuEntry): entry is TabContextMenuActionEntry =>
  !('separator' in entry)

/** Add a cursor-anchored context menu to an Iris admin tab strip. */
export function useAdminTabContextMenu(options: AdminTabContextMenuOptions): AdminTabContextMenu {
  const state = ref<{ key: string } | null>(null)
  const anchorRef = ref<HTMLElement | null>(null)
  const menuRef = ref<HTMLElement | null>(null)
  const hoveredItem = ref<TabAction | null>(null)
  const open = computed(() => state.value !== null)
  const close = (): void => {
    state.value = null
    hoveredItem.value = null
  }

  const virtualCursorAnchor = (event: MouseEvent): HTMLElement =>
    ({
      getBoundingClientRect: () => ({
        left: event.clientX,
        top: event.clientY,
        right: event.clientX,
        bottom: event.clientY,
        width: 0,
        height: 0,
        x: event.clientX,
        y: event.clientY,
        toJSON() {},
      }),
    }) as unknown as HTMLElement

  const show = (event: MouseEvent, key: string): void => {
    event.preventDefault()
    event.stopPropagation()
    anchorRef.value = virtualCursorAnchor(event)
    state.value = { key }
  }

  const items = computed<TabContextMenuEntry[]>(() => {
    const key = state.value?.key
    if (!key) return []
    const tabs = options.tabs.value
    const index = tabs.findIndex((tab) => tab.key === key)
    const tab = tabs[index]
    if (!tab) return []

    const hasClosableLeft = tabs.slice(0, index).some(isClosable)
    const hasClosableRight = tabs.slice(index + 1).some(isClosable)
    const hasClosableOthers = tabs.some((item) => item.key !== key && isClosable(item))
    const hasClosableTab = tabs.some(isClosable)
    return [
      { key: 'refresh', label: options.t('admin.refresh'), icon: 'refresh' },
      {
        key: 'close',
        label: options.t('admin.close'),
        icon: 'x',
        disabled: !isClosable(tab),
      },
      { key: 'separator', separator: true },
      {
        key: 'closeLeft',
        label: options.t('admin.closeLeft'),
        icon: 'arrow-left',
        disabled: !hasClosableLeft,
      },
      {
        key: 'closeRight',
        label: options.t('admin.closeRight'),
        icon: 'arrow-right',
        disabled: !hasClosableRight,
      },
      {
        key: 'closeOthers',
        label: options.t('admin.closeOthers'),
        icon: 'columns',
        disabled: !hasClosableOthers,
      },
      {
        key: 'closeAll',
        label: options.t('admin.closeAll'),
        icon: 'trash',
        disabled: !hasClosableTab,
      },
    ]
  })

  const select = (action: TabAction): void => {
    const key = state.value?.key
    const item = items.value.find(
      (entry): entry is TabContextMenuActionEntry => isActionEntry(entry) && entry.key === action,
    )
    if (!key || !item || item.disabled) return
    close()
    options.onAction(key, action)
  }

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: menuRef,
    open,
    placement: 'bottom-start',
    strategy: 'fixed',
    offset: 0,
    flip: false,
    shift: false,
  })
  useDismiss({ enabled: open, exclude: [menuRef], onDismiss: close })

  const onKeydown = (event: KeyboardEvent): void => {
    const enabledItems = Array.from(
      menuRef.value?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ) ?? [],
    )
    if (enabledItems.length === 0) return
    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        enabledItems[nextEnabledIndex(currentIndex, 1, enabledItems.length)]?.focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        enabledItems[nextEnabledIndex(currentIndex, -1, enabledItems.length)]?.focus()
        break
      case 'Home':
        event.preventDefault()
        enabledItems[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        enabledItems[enabledItems.length - 1]?.focus()
        break
      case 'Tab':
        close()
        break
    }
  }

  watch(open, async (isOpen) => {
    if (typeof document !== 'undefined') {
      if (isOpen) document.addEventListener('scroll', close, true)
      else document.removeEventListener('scroll', close, true)
    }
    if (isOpen) {
      await nextTick()
      menuRef.value
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
        ?.focus()
    }
  })
  onScopeDispose(() => {
    if (typeof document !== 'undefined') document.removeEventListener('scroll', close, true)
  })

  const render = (): VNode | null => {
    if (!state.value) return null
    const node = h(
      'div',
      {
        ref: (element: unknown) => {
          menuRef.value = (element ?? null) as HTMLElement | null
        },
        role: 'menu',
        tabindex: -1,
        'aria-label': options.t('admin.tabActions'),
        'data-iris-admin-tab-context-menu': '',
        onKeydown,
        style: {
          ...floatingStyles.value,
          zIndex: 'var(--iris-z-popover, 1000)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--iris-space-xxs, 4px)',
          minWidth: '180px',
          padding: 'var(--iris-space-xxs, 4px)',
          background: 'var(--iris-surface-floating, var(--iris-surface))',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          boxShadow: 'var(--iris-shadow-lg)',
        },
      },
      items.value.map((entry) => {
        if ('separator' in entry) {
          return h('div', {
            key: entry.key,
            role: 'separator',
            'data-iris-admin-tab-context-menu-separator': '',
            style: { height: '1px', background: 'var(--iris-border)' },
          })
        }
        const active = hoveredItem.value === entry.key
        return h(
          'button',
          {
            key: entry.key,
            type: 'button',
            role: 'menuitem',
            'data-iris-admin-tab-context-menu-item': entry.key,
            disabled: entry.disabled,
            'aria-disabled': entry.disabled ? 'true' : undefined,
            onClick: () => select(entry.key),
            onPointerenter: () => (hoveredItem.value = entry.key),
            onPointerleave: () => (hoveredItem.value = null),
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--iris-space-sm, 12px)',
              width: '100%',
              minHeight: 'var(--iris-control-height-md, 34px)',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
              border: 'none',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              background: active ? 'var(--iris-surface-hover)' : 'transparent',
              color: 'inherit',
              font: 'inherit',
              textAlign: 'start',
              cursor: entry.disabled ? 'not-allowed' : 'pointer',
              opacity: entry.disabled ? '0.5' : '1',
            },
          },
          [h(IrisIcon, { name: entry.icon, size: 15 }), h('span', entry.label)],
        )
      }),
    )
    return h(Teleport, { to: 'body' }, [node])
  }

  return { open: show, render }
}
