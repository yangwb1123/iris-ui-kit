<script lang="ts">
  import { portal } from '../../internal/portal'
  import { useI18n } from '../../i18n'
  import { useFocusTrap } from '../modal-utils/useFocusTrap.svelte'
  import type { IrisCommandItem } from './types'
  import { defaultFilter } from './types'

  interface Props {
    open?: boolean
    items?: IrisCommandItem[]
    placeholder?: string
    emptyText?: string
    filter?: (query: string, item: IrisCommandItem) => number | null
    onOpenChange?: (open: boolean) => void
    onSelect?: (item: IrisCommandItem) => void
  }

  let {
    open = false,
    items = [],
    placeholder,
    emptyText,
    filter = defaultFilter,
    onOpenChange,
    onSelect,
  }: Props = $props()

  const { t } = useI18n()

  const resolvedPlaceholder = $derived(placeholder ?? t('commandPalette.placeholder'))

  let query = $state('')
  let activeIndex = $state(0)
  let inputEl = $state<HTMLInputElement | undefined>(undefined)
  let panelEl = $state<HTMLElement | undefined>(undefined)

  // Trap Tab focus inside the panel and restore focus to the previously-focused
  // element on close (matches React/Vue, which use the same focus-trap).
  useFocusTrap({ container: () => panelEl, active: () => open })

  $effect(() => {
    if (open) {
      query = ''
      activeIndex = 0
      requestAnimationFrame(() => inputEl?.focus())
    }
  })

  $effect(() => {
    void query
    activeIndex = 0
  })

  type Row =
    | { kind: 'header'; label: string }
    | { kind: 'item'; item: IrisCommandItem }

  const matches = $derived(
    (() => {
      const result: { item: IrisCommandItem; score: number }[] = []
      for (const item of items) {
        const score = filter(query, item)
        if (score !== null) result.push({ item, score })
      }
      return result.sort((a, b) => a.score - b.score)
    })()
  )

  const rows = $derived<Row[]>(
    (() => {
      const out: Row[] = []
      let currentGroup: string | undefined = undefined
      for (const m of matches) {
        const g = m.item.group
        if (g !== currentGroup) {
          if (g) out.push({ kind: 'header', label: g })
          currentGroup = g
        }
        out.push({ kind: 'item', item: m.item })
      }
      return out
    })()
  )

  const enabledItems = $derived(
    rows.filter((r): r is { kind: 'item'; item: IrisCommandItem } => r.kind === 'item' && !r.item.disabled)
  )

  function close() {
    onOpenChange?.(false)
  }

  function selectItem(item: IrisCommandItem) {
    if (item.disabled) return
    item.action?.()
    onSelect?.(item)
    close()
  }

  function onKeyDown(e: KeyboardEvent) {
    const ei = enabledItems
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = (activeIndex + 1) % Math.max(1, ei.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = (activeIndex - 1 + Math.max(1, ei.length)) % Math.max(1, ei.length)
        break
      case 'Enter':
        e.preventDefault()
        if (ei[activeIndex]) selectItem(ei[activeIndex].item)
        break
    }
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close()
  }
</script>

{#if open}
  <div
    use:portal
    data-iris-command-palette-backdrop
    role="presentation"
    onclick={onBackdropClick}
    onkeydown={onKeyDown}
    style:position="fixed"
    style:inset="0"
    style:z-index="100"
    style:display="flex"
    style:align-items="flex-start"
    style:justify-content="center"
    style:padding-top="15vh"
    style:background="rgba(0,0,0,0.4)"
  >
    <div
      bind:this={panelEl}
      data-iris-command-palette
      role="dialog"
      aria-modal="true"
      aria-label={t('commandPalette.label')}
      style:background="var(--iris-background)"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-lg, 8px)"
      style:box-shadow="0 16px 48px rgba(0,0,0,0.2)"
      style:width="min(560px, 90vw)"
      style:overflow="hidden"
      style:display="flex"
      style:flex-direction="column"
    >
      <!-- Search input -->
      <div style:padding="12px 16px" style:border-bottom="1px solid var(--iris-border)">
        <input
          bind:this={inputEl}
          bind:value={query}
          type="text"
          placeholder={resolvedPlaceholder}
          data-iris-command-palette-input
          style:width="100%"
          style:border="none"
          style:outline="none"
          style:background="transparent"
          style:color="var(--iris-foreground)"
          style:font-size="16px"
          style:font-family="inherit"
        />
      </div>

      <!-- Results -->
      <div
        data-iris-command-palette-list
        role="listbox"
        style:overflow-y="auto"
        style:max-height="360px"
        style:padding="4px"
      >
        {#if rows.length === 0}
          <div
            data-iris-command-palette-empty
            style:padding="24px"
            style:text-align="center"
            style:color="var(--iris-muted)"
            style:font-size="14px"
          >{emptyText ?? t('commandPalette.empty')}</div>
        {:else}
          {#each rows as row, i (row.kind === 'item' ? row.item.id : `header-${i}`)}
            {#if row.kind === 'header'}
              <div
                data-iris-command-palette-group
                style:padding="6px 8px 2px"
                style:font-size="11px"
                style:font-weight="600"
                style:color="var(--iris-muted)"
                style:text-transform="uppercase"
                style:letter-spacing="0.05em"
              >{row.label}</div>
            {:else}
              {@const eiIdx = enabledItems.findIndex(x => x.item.id === row.item.id)}
              {@const isActive = eiIdx === activeIndex && !row.item.disabled}
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                aria-disabled={row.item.disabled ? 'true' : undefined}
                data-iris-command-palette-item
                data-state={isActive ? 'active' : 'idle'}
                onclick={() => selectItem(row.item)}
                style:width="100%"
                style:display="flex"
                style:align-items="center"
                style:gap="8px"
                style:padding="8px 12px"
                style:border="none"
                style:border-radius="var(--iris-radius-sm, 4px)"
                style:background={isActive ? 'var(--iris-surface-hover)' : 'transparent'}
                style:color={row.item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)'}
                style:cursor={row.item.disabled ? 'not-allowed' : 'pointer'}
                style:text-align="start"
                style:font-size="14px"
                style:font-family="inherit"
                style:opacity={row.item.disabled ? '0.5' : '1'}
              >
                {#if row.item.icon}
                  <span aria-hidden="true">{row.item.icon}</span>
                {/if}
                <span style:flex="1">{row.item.label}</span>
                {#if row.item.shortcut}
                  <kbd
                    style:font-size="11px"
                    style:padding="2px 5px"
                    style:border="1px solid var(--iris-border)"
                    style:border-radius="3px"
                    style:background="var(--iris-surface)"
                    style:color="var(--iris-muted)"
                  >{row.item.shortcut}</kbd>
                {/if}
              </button>
            {/if}
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
