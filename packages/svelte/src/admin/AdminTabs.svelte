<script lang="ts">
  import { isClosable, type TabItem } from '@iris-ui-kit/core'
  import { useTabsNav } from './useTabsNav'
  import IrisIcon from '../primitives/icon/IrisIcon.svelte'
  import IrisDropdown from '../primitives/dropdown/Dropdown.svelte'
  import IrisDropdownTrigger from '../primitives/dropdown/DropdownTrigger.svelte'
  import IrisDropdownMenu from '../primitives/dropdown/DropdownMenu.svelte'
  import IrisDropdownItem from '../primitives/dropdown/DropdownItem.svelte'
  import IrisDropdownSeparator from '../primitives/dropdown/DropdownSeparator.svelte'
  import IrisSortable from '../behaviors/IrisSortable.svelte'
  import { styleToString } from '../internal/style'
  import { useI18n } from '../i18n'
  import type { IrisAdminTabsProps } from './types'

  const { t: translate } = useI18n()

  let {
    nav,
    onChange,
    onClose,
    onRefresh,
    reorderable = true,
    onReorder,
  }: IrisAdminTabsProps = $props()
  // svelte-ignore state_referenced_locally — `nav` is a stable store instance.
  const t = useTabsNav(nav)
  const { tabs, activeKey } = t

  let tablistEl: HTMLDivElement | undefined = $state()
  let pendingFocus: string | null = null

  function focusPending(): void {
    if (!pendingFocus || !tablistEl) return
    const key = pendingFocus
    pendingFocus = null
    tablistEl.querySelectorAll<HTMLElement>('[data-iris-tab-label]').forEach((el) => {
      if (el.getAttribute('data-key') === key) el.focus()
    })
  }

  function activate(key: string): void {
    nav.activate(key)
    onChange?.(key)
  }
  function close(key: string): void {
    nav.close(key)
    onClose?.(key)
  }
  function refresh(key: string): void {
    nav.refresh(key)
    onRefresh?.(key)
  }
  function reorder(items: unknown[]): void {
    const next = items as TabItem[]
    next.forEach((tab, index) => nav.move(tab.key, index))
    onReorder?.(next)
  }

  function onKeyDown(e: KeyboardEvent): void {
    const list = $tabs
    const idx = list.findIndex((x) => x.key === $activeKey)
    if (idx < 0 || list.length === 0) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const cur = list[idx]
      if (cur && isClosable(cur)) {
        e.preventDefault()
        close(cur.key)
        pendingFocus = nav.getState().activeKey ?? null
        queueMicrotask(focusPending)
      }
      return
    }
    let target = -1
    if (e.key === 'ArrowRight') target = (idx + 1) % list.length
    else if (e.key === 'ArrowLeft') target = (idx - 1 + list.length) % list.length
    else if (e.key === 'Home') target = 0
    else if (e.key === 'End') target = list.length - 1
    else return
    e.preventDefault()
    const key = list[target]?.key
    if (!key) return
    activate(key)
    pendingFocus = key
    queueMicrotask(focusPending)
  }

  function chipStyle(active: boolean): string {
    return styleToString({
      display: 'inline-flex',
      'align-items': 'center',
      gap: '4px',
      padding:
        'var(--iris-padding-sm, 6px) var(--iris-space-xs, 8px) var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
      'border-radius': 'var(--iris-radius-md, 6px)',
      border: `1px solid ${active ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
      background: active ? 'var(--iris-primary)' : 'var(--iris-surface)',
      color: active ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
      flex: '0 0 auto',
    })
  }

  const LABEL_STYLE =
    'display: inline-flex; align-items: center; gap: var(--iris-space-xs, 8px); border: none; background: transparent; color: inherit; font: inherit; font-size: var(--iris-font-size-sm, 13px); cursor: pointer; padding: 0'
  const CLOSE_STYLE =
    'display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border: none; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; padding: 0; opacity: 0.6'
  const TRIGGER_STYLE =
    'display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--iris-radius-md, 6px); border: 1px solid var(--iris-border); background: var(--iris-surface); color: var(--iris-foreground); cursor: pointer'
</script>

<div
  data-iris-admin-tabs
  style="display: flex; align-items: center; gap: var(--iris-space-xs, 8px); padding: var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px); border-bottom: 1px solid var(--iris-border); background: var(--iris-background)"
>
  <!-- svelte-ignore a11y_interactive_supports_focus — WAI-ARIA tabs: roving tabindex lives on the tabs -->
  <div
    bind:this={tablistEl}
    data-iris-tabs-scroll
    role="tablist"
    aria-label={translate('admin.openPages')}
    onkeydown={onKeyDown}
    style="overflow-x: auto; flex: 1"
  >
    <IrisSortable
      items={$tabs}
      getKey={(item) => (item as TabItem).key}
      onReorder={reorder}
      disabled={!reorderable}
      orientation="horizontal"
      containerRole="presentation"
      itemRole="presentation"
    >
      {#snippet children(value)}
        {@const tab = value as TabItem}
        {@const active = tab.key === $activeKey}
        {@const closable = isClosable(tab)}
        <div data-iris-tab data-active={active ? 'true' : undefined} style={chipStyle(active)}>
          <button
            type="button"
            role="tab"
            data-iris-tab-label
            data-key={tab.key}
            aria-selected={active ? 'true' : 'false'}
            aria-current={active ? 'page' : undefined}
            tabindex={active ? 0 : -1}
            style={LABEL_STYLE}
            onclick={() => activate(tab.key)}
          >
            {#if tab.icon}<IrisIcon name={tab.icon} size={14} />{/if}
            <span style="white-space: nowrap">{tab.title}</span>
          </button>
          {#if closable}
            <button
              type="button"
              tabindex={-1}
              data-iris-tab-close
              aria-label={translate('admin.closeTab', { title: tab.title })}
              style={CLOSE_STYLE}
              onclick={(e) => {
                e.stopPropagation()
                close(tab.key)
              }}
            >
              <IrisIcon name="x" size={12} />
            </button>
          {:else if tab.pinned}
            <IrisIcon name="check-circle" size={12} style="opacity: 0.5" />
          {/if}
        </div>
      {/snippet}
    </IrisSortable>
  </div>

  <IrisDropdown>
    <IrisDropdownTrigger aria-label={translate('admin.tabActions')} style={TRIGGER_STYLE}>
      <IrisIcon name="more-horizontal" size={16} />
    </IrisDropdownTrigger>
    <IrisDropdownMenu>
      {#if $activeKey}
        {@const key = $activeKey}
        <IrisDropdownItem onSelect={() => refresh(key)}
          >{translate('admin.refresh')}</IrisDropdownItem
        >
        <IrisDropdownItem onSelect={() => close(key)}>{translate('admin.close')}</IrisDropdownItem>
        <IrisDropdownSeparator />
        <IrisDropdownItem onSelect={() => nav.closeLeft(key)}
          >{translate('admin.closeLeft')}</IrisDropdownItem
        >
        <IrisDropdownItem onSelect={() => nav.closeRight(key)}
          >{translate('admin.closeRight')}</IrisDropdownItem
        >
        <IrisDropdownItem onSelect={() => nav.closeOthers(key)}
          >{translate('admin.closeOthers')}</IrisDropdownItem
        >
        <IrisDropdownItem onSelect={() => nav.closeAll()}
          >{translate('admin.closeAll')}</IrisDropdownItem
        >
      {:else}
        <IrisDropdownItem disabled>No active tab</IrisDropdownItem>
      {/if}
    </IrisDropdownMenu>
  </IrisDropdown>
</div>
