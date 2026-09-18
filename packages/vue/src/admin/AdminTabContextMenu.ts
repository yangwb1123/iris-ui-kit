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
import {
  DEFAULT_TAB_SHORTCUTS,
  firstShortcut,
  isInputTarget,
  matchesShortcut,
  shortcutSpecs,
  type TabAction,
  type TabShortcut,
  type TabShortcutMap,
} from './tab-context-menu-shortcuts'

export { DEFAULT_TAB_SHORTCUTS } from './tab-context-menu-shortcuts'
export type { TabAction, TabShortcut, TabShortcutMap } from './tab-context-menu-shortcuts'

type Translate = UseI18nReturn['t']

type TabContextMenuActionEntry = {
  kind: 'action'
  key: TabAction
  label: string
  icon: string
  disabled?: boolean
  shortcut?: string
}
type TabContextMenuGroupEntry = {
  kind: 'group'
  key: string
  label: string
  icon: string
  disabled?: boolean
  children: TabContextMenuEntry[]
}
type TabContextMenuSeparatorEntry = { kind: 'separator'; key: string; separator: true }
type TabContextMenuEntry =
  TabContextMenuActionEntry | TabContextMenuGroupEntry | TabContextMenuSeparatorEntry

export interface AdminTabContextMenuOptions {
  tabs: ComputedRef<TabItem[]>
  activeKey?: ComputedRef<string | undefined>
  t: Translate
  onAction: (key: string, action: TabAction) => void
  shortcuts?: TabShortcutMap
}

export interface AdminTabContextMenu {
  open: (event: MouseEvent, key: string) => void
  render: () => VNode | null
}

const isActionEntry = (entry: TabContextMenuEntry): entry is TabContextMenuActionEntry =>
  entry.kind === 'action'
const isGroupEntry = (entry: TabContextMenuEntry): entry is TabContextMenuGroupEntry =>
  entry.kind === 'group'

/** Add a cursor-anchored, nested, keyboard-bindable context menu to admin tabs. */
export function useAdminTabContextMenu(options: AdminTabContextMenuOptions): AdminTabContextMenu {
  const state = ref<{ key: string } | null>(null)
  const anchorRef = ref<HTMLElement | null>(null)
  const menuRef = ref<HTMLElement | null>(null)
  const openPath = ref<string[]>([])
  const open = computed(() => state.value !== null)
  const hoveredPath = ref<string | null>(null)
  const close = (): void => {
    state.value = null
    openPath.value = []
    hoveredPath.value = null
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
    openPath.value = []
    hoveredPath.value = null
    state.value = { key }
  }

  const configuredShortcut = (action: TabAction): TabShortcut | undefined =>
    options.shortcuts?.[action] ?? DEFAULT_TAB_SHORTCUTS[action]

  const action = (
    key: TabAction,
    label: string,
    icon: string,
    disabled = false,
  ): TabContextMenuActionEntry => ({
    kind: 'action',
    key,
    label,
    icon,
    disabled,
    shortcut: firstShortcut(configuredShortcut(key)),
  })

  const entriesFor = (key: string): TabContextMenuEntry[] => {
    const tabs = options.tabs.value
    const index = tabs.findIndex((tab) => tab.key === key)
    const tab = tabs[index]
    if (!tab) return []

    const hasClosableLeft = tabs.slice(0, index).some(isClosable)
    const hasClosableRight = tabs.slice(index + 1).some(isClosable)
    const hasClosableOthers = tabs.some((item) => item.key !== key && isClosable(item))
    const hasClosableTab = tabs.some(isClosable)
    const closeEntries: TabContextMenuEntry[] = [
      { kind: 'separator', key: 'close-separator', separator: true },
      action('closeLeft', options.t('admin.closeLeft'), 'arrow-left', !hasClosableLeft),
      action('closeRight', options.t('admin.closeRight'), 'arrow-right', !hasClosableRight),
      action('closeOthers', options.t('admin.closeOthers'), 'columns', !hasClosableOthers),
      action('closeAll', options.t('admin.closeAll'), 'trash', !hasClosableTab),
    ]

    return [
      action('refresh', options.t('admin.refresh'), 'refresh'),
      action('close', options.t('admin.close'), 'x', !isClosable(tab)),
      { kind: 'separator', key: 'close-group-separator', separator: true },
      {
        kind: 'group',
        key: 'close-group',
        label: options.t('admin.tabActions'),
        icon: 'more-horizontal',
        disabled: closeEntries.every((entry) => !isActionEntry(entry) || entry.disabled),
        children: closeEntries,
      },
    ]
  }

  const items = computed<TabContextMenuEntry[]>(() => {
    const key = state.value?.key
    return key ? entriesFor(key) : []
  })

  const findAction = (
    entries: readonly TabContextMenuEntry[],
    key: TabAction,
  ): TabContextMenuActionEntry | null => {
    for (const entry of entries) {
      if (isActionEntry(entry) && entry.key === key) return entry
      if (isGroupEntry(entry)) {
        const nested = findAction(entry.children, key)
        if (nested) return nested
      }
    }
    return null
  }

  const select = (actionKey: TabAction): void => {
    const key = state.value?.key
    const item = findAction(items.value, actionKey)
    if (!key || !item || item.disabled) return
    close()
    options.onAction(key, actionKey)
  }

  const itemsForShortcut = (key: string): TabContextMenuActionEntry[] => {
    const flatten = (entries: readonly TabContextMenuEntry[]): TabContextMenuActionEntry[] =>
      entries.flatMap((entry) =>
        isActionEntry(entry) ? [entry] : isGroupEntry(entry) ? flatten(entry.children) : [],
      )
    return flatten(entriesFor(key))
  }

  const activeShortcutTarget = (): string | undefined =>
    state.value?.key ?? options.activeKey?.value

  const onShortcut = (event: KeyboardEvent): void => {
    if (isInputTarget(event.target)) return
    const key = activeShortcutTarget()
    if (!key) return
    const entry = itemsForShortcut(key).find((item) =>
      shortcutSpecs(configuredShortcut(item.key)).some((spec) => matchesShortcut(event, spec)),
    )
    if (!entry || entry.disabled) return
    event.preventDefault()
    event.stopPropagation()
    if (state.value) close()
    options.onAction(key, entry.key)
  }

  if (typeof document !== 'undefined') document.addEventListener('keydown', onShortcut)
  onScopeDispose(() => {
    if (typeof document !== 'undefined') document.removeEventListener('keydown', onShortcut)
  })

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

  const openGroup = (path: string[]): void => {
    openPath.value = [...path]
  }
  const isGroupOpen = (path: readonly string[]): boolean =>
    path.every((key, index) => openPath.value[index] === key)
  const pathAttribute = (path: readonly string[]): string => path.join('/')
  const activatePath = (path: string[], disabled: boolean): void => {
    if (disabled) return
    hoveredPath.value = pathAttribute(path)
    openGroup(path)
  }
  const clearHovered = (path: string[]): void => {
    if (hoveredPath.value === pathAttribute(path)) hoveredPath.value = null
  }
  const shortcutNode = (shortcut: string | undefined): VNode | null =>
    shortcut
      ? h(
          'kbd',
          {
            'data-iris-admin-tab-context-menu-shortcut': '',
            style: {
              marginInlineStart: 'auto',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
              color: 'var(--iris-muted)',
              font: 'var(--iris-font-mono, 12px/1 ui-monospace, monospace)',
              whiteSpace: 'nowrap',
            },
          },
          shortcut,
        )
      : null

  const itemStyle = (active: boolean, disabled: boolean): Record<string, string> => ({
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
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? '0.5' : '1',
  })

  function groupItem(entry: TabContextMenuGroupEntry, path: string[]): VNode {
    const expanded = isGroupOpen(path)
    const disabled = Boolean(entry.disabled)
    const group = h(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        'aria-haspopup': 'menu',
        'aria-expanded': expanded ? 'true' : 'false',
        'aria-disabled': disabled ? 'true' : undefined,
        'data-iris-admin-tab-context-menu-group': entry.key,
        'data-iris-admin-tab-context-menu-group-path': pathAttribute(path),
        disabled,
        onPointerenter: () => activatePath(path, disabled),
        onFocus: () => activatePath(path, disabled),
        onClick: (event: MouseEvent) => {
          event.preventDefault()
          if (!disabled) openGroup(expanded ? path.slice(0, -1) : path)
        },
        style: itemStyle(expanded || hoveredPath.value === pathAttribute(path), disabled),
      },
      [
        h(IrisIcon, { name: entry.icon, size: 15 }),
        h('span', { style: { flex: '1' } }, entry.label),
        h(IrisIcon, { name: 'chevron-right', size: 14 }),
      ],
    )
    return h('div', { style: { position: 'relative' } }, [
      group,
      h(
        'div',
        {
          role: 'menu',
          'aria-hidden': expanded && !disabled ? 'false' : 'true',
          'data-iris-admin-tab-context-submenu': '',
          'data-iris-admin-tab-context-menu-group-path': pathAttribute(path),
          style: {
            position: 'absolute',
            top: 'calc(-1 * var(--iris-space-xxs, 4px))',
            insetInlineStart: 'calc(100% - var(--iris-space-xxs, 4px))',
            display: expanded && !disabled ? 'flex' : 'none',
            flexDirection: 'column',
            gap: 'var(--iris-space-xxs, 4px)',
            minWidth: '220px',
            padding: 'var(--iris-space-xxs, 4px)',
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            boxShadow: 'var(--iris-shadow-lg)',
            zIndex: String(1001 + path.length),
          },
        },
        entry.children.map((child) => renderEntry(child, path)),
      ),
    ])
  }

  function renderEntry(entry: TabContextMenuEntry, parentPath: string[] = []): VNode {
    if (entry.kind === 'separator') {
      return h('div', {
        key: entry.key,
        role: 'separator',
        'data-iris-admin-tab-context-menu-separator': '',
        style: { height: '1px', background: 'var(--iris-border)' },
      })
    }
    if (isGroupEntry(entry)) return groupItem(entry, [...parentPath, entry.key])

    const active =
      document.activeElement?.getAttribute('data-iris-admin-tab-context-menu-item') === entry.key
    const disabled = Boolean(entry.disabled)
    const itemPath = [...parentPath, entry.key]
    return h(
      'button',
      {
        key: entry.key,
        type: 'button',
        role: 'menuitem',
        'data-iris-admin-tab-context-menu-item': entry.key,
        disabled,
        'aria-disabled': disabled ? 'true' : undefined,
        onClick: () => select(entry.key),
        onPointerenter: () => activatePath(itemPath, disabled),
        onPointerleave: () => clearHovered(itemPath),
        onFocus: () => activatePath(itemPath, disabled),
        style: itemStyle(active || hoveredPath.value === pathAttribute(itemPath), disabled),
      },
      [
        h(IrisIcon, { name: entry.icon, size: 15 }),
        h('span', { style: { flex: '1' } }, entry.label),
        shortcutNode(entry.shortcut),
      ],
    )
  }

  const isHiddenMenuItem = (element: HTMLElement): boolean =>
    Boolean(element.closest('[data-iris-admin-tab-context-submenu][aria-hidden="true"]'))

  const enabledMenuItems = (container: HTMLElement | null): HTMLElement[] =>
    Array.from(
      container?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ??
        [],
    ).filter((element) => !isHiddenMenuItem(element))

  const focusFirst = (container: HTMLElement | null): void => {
    enabledMenuItems(container)[0]?.focus()
  }

  const onKeydown = (event: KeyboardEvent): void => {
    const enabledItems = enabledMenuItems(menuRef.value)
    if (enabledItems.length === 0) return
    const current = document.activeElement as HTMLElement | null
    const currentIndex = current ? enabledItems.indexOf(current) : -1
    const currentGroup = current?.getAttribute('data-iris-admin-tab-context-menu-group-path')
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        enabledItems[nextEnabledIndex(currentIndex, 1, enabledItems.length)]?.focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        enabledItems[nextEnabledIndex(currentIndex, -1, enabledItems.length)]?.focus()
        break
      case 'ArrowRight':
        if (!current?.hasAttribute('data-iris-admin-tab-context-menu-group')) return
        event.preventDefault()
        openGroup((currentGroup ?? '').split('/').filter(Boolean))
        void nextTick(() => {
          const submenu = menuRef.value?.querySelector<HTMLElement>(
            `[data-iris-admin-tab-context-submenu][data-iris-admin-tab-context-menu-group-path="${currentGroup ?? ''}"]`,
          )
          focusFirst(submenu ?? null)
        })
        break
      case 'ArrowLeft': {
        const submenu = current?.closest<HTMLElement>('[data-iris-admin-tab-context-submenu]')
        if (!submenu) return
        event.preventDefault()
        const path = (submenu.getAttribute('data-iris-admin-tab-context-menu-group-path') ?? '')
          .split('/')
          .filter(Boolean)
        openGroup(path.slice(0, -1))
        void nextTick(() => {
          menuRef.value
            ?.querySelector<HTMLElement>(
              `[data-iris-admin-tab-context-menu-group-path="${path.join('/')}" ]`,
            )
            ?.focus()
        })
        break
      }
      case 'Home':
        event.preventDefault()
        enabledItems[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        enabledItems[enabledItems.length - 1]?.focus()
        break
      case 'Enter':
      case ' ': {
        if (!current?.hasAttribute('data-iris-admin-tab-context-menu-group')) return
        event.preventDefault()
        current.click()
        break
      }
      case 'Tab':
        close()
        break
    }
  }

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
      items.value.map((entry) => renderEntry(entry)),
    )
    return h(Teleport, { to: 'body' }, [node])
  }

  // Focus the first enabled root item after the teleported menu is mounted.
  watch(open, async (isOpen) => {
    if (typeof document !== 'undefined') {
      if (isOpen) document.addEventListener('scroll', close, true)
      else document.removeEventListener('scroll', close, true)
    }
    if (!isOpen) return
    await nextTick()
    focusFirst(menuRef.value)
  })
  onScopeDispose(() => {
    if (typeof document !== 'undefined') document.removeEventListener('scroll', close, true)
  })

  return { open: show, render }
}
