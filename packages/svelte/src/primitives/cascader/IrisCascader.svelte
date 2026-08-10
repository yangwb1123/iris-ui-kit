<script lang="ts">
  import { generateId } from '@iris-ui-kit/core'
  import { useI18n } from '../../i18n'
  import IrisVirtualScroll from '../virtual-scroll/IrisVirtualScroll.svelte'

  export interface IrisCascaderNode {
    label: string
    value: string
    disabled?: boolean
    children?: IrisCascaderNode[]
  }

  export type IrisCascaderSize = 'sm' | 'md' | 'lg'

  interface Props {
    options?: IrisCascaderNode[]
    value?: string[]
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    separator?: string
    size?: IrisCascaderSize
    /**
     * Opt-in: window each open column with the core virtualizer instead of
     * rendering every option. Fixed deterministic sizing (viewport 240px, row
     * height per size, buffer 4). Default false — no behavior change.
     */
    virtual?: boolean
    id?: string
    onValueChange?: (path: string[]) => void
    style?: string
    class?: string
  }

  const SIZE_MAP: Record<
    IrisCascaderSize,
    { padding: string; fontSize: string; minHeight: string }
  > = {
    sm: {
      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
      fontSize: 'var(--iris-font-size-xs, 12px)',
      minHeight: '28px',
    },
    md: {
      padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      minHeight: '34px',
    },
    lg: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-lg, 16px)',
      minHeight: '40px',
    },
  }

  /** Matches the current `maxHeight: 240` of a column. */
  const CASCADER_COLUMN_VIEWPORT = 240
  /** Fixed row heights, aligned with SIZE_MAP minHeights so rows never clip. */
  const CASCADER_ROW_HEIGHT: Record<IrisCascaderSize, number> = { sm: 28, md: 34, lg: 40 }
  /** Extra rows rendered above and below the visible window. */
  const CASCADER_VIRTUAL_BUFFER = 4

  let {
    options = [],
    value = [],
    placeholder,
    disabled = false,
    invalid = false,
    separator = ' / ',
    size = 'md',
    id,
    onValueChange,
    style,
    class: className,
    virtual = false,
    ...rest
  }: Props = $props()

  const { t } = useI18n()
  const popupId = `${generateId()}-popup`

  let open = $state(false)
  let activePath = $state<string[]>([])
  let containerEl = $state<HTMLElement | undefined>(undefined)

  function pathLabels(nodes: IrisCascaderNode[], path: string[]): string[] {
    const labels: string[] = []
    let level = nodes
    for (const v of path) {
      const node = level.find((n) => n.value === v)
      if (!node) break
      labels.push(node.label)
      level = node.children ?? []
    }
    return labels
  }

  function buildColumns(nodes: IrisCascaderNode[], path: string[]): IrisCascaderNode[][] {
    const cols: IrisCascaderNode[][] = [nodes]
    let level = nodes
    for (const v of path) {
      const node = level.find((n) => n.value === v)
      if (!node || !node.children || node.children.length === 0) break
      level = node.children
      cols.push(level)
    }
    return cols
  }

  const labels = $derived(pathLabels(options, value))
  const display = $derived(labels.join(separator))
  const columns = $derived(buildColumns(options, activePath))

  function toggle() {
    if (disabled) return
    if (!open) activePath = [...value]
    open = !open
  }

  // Trigger keyboard: Escape closes; ArrowDown/Enter open (mirrors React/Vue).
  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      open = false
    } else if ((e.key === 'ArrowDown' || e.key === 'Enter') && !open) {
      e.preventDefault()
      if (!disabled) {
        activePath = [...value]
        open = true
      }
    }
  }

  function selectOption(colIndex: number, node: IrisCascaderNode) {
    if (node.disabled) return
    const nextPath = [...activePath.slice(0, colIndex), node.value]
    activePath = nextPath
    const hasChildren = !!node.children && node.children.length > 0
    if (!hasChildren) {
      onValueChange?.(nextPath)
      open = false
    }
  }

  function onDocDown(e: MouseEvent) {
    if (open && containerEl && !containerEl.contains(e.target as Node)) open = false
  }

  $effect(() => {
    if (open) document.addEventListener('mousedown', onDocDown)
    else document.removeEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  })

  // Keep the next-open navigation path aligned with a controlled value update.
  $effect(() => {
    if (!open) activePath = [...value]
  })

  const sz = $derived(SIZE_MAP[size])
  const borderColor = $derived(invalid ? 'var(--iris-danger)' : 'var(--iris-border)')
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_role_supports_aria_props_implicit -->

<div
  bind:this={containerEl}
  data-iris-cascader
  data-disabled={disabled ? '' : undefined}
  style:position="relative"
  style:display="inline-flex"
  {style}
  class={className}
  {...rest}
>
  <button
    type="button"
    role="combobox"
    {id}
    {disabled}
    aria-invalid={invalid ? 'true' : undefined}
    aria-expanded={open}
    aria-controls={popupId}
    aria-haspopup="listbox"
    data-iris-cascader-trigger
    onkeydown={onTriggerKeyDown}
    data-state={open ? 'open' : 'closed'}
    onclick={toggle}
    style:display="inline-flex"
    style:align-items="center"
    style:justify-content="space-between"
    style:gap="var(--iris-space-xs, 8px)"
    style:padding={sz.padding}
    style:font-size={sz.fontSize}
    style:min-height={sz.minHeight}
    style:min-width="160px"
    style:background="var(--iris-background)"
    style:color={value.length > 0 ? 'var(--iris-foreground)' : 'var(--iris-muted)'}
    style:border={`1px solid ${borderColor}`}
    style:border-radius="var(--iris-radius-md, 6px)"
    style:cursor={disabled ? 'not-allowed' : 'pointer'}
    style:font-family="inherit"
  >
    <span style:flex="1" style:text-align="start"
      >{display || (placeholder ?? t('select.placeholder'))}</span
    >
    <span aria-hidden="true" style:font-size="10px">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <div
      id={popupId}
      data-iris-cascader-dropdown
      style:position="absolute"
      style:top="calc(100% + 4px)"
      style:left="0"
      style:z-index="50"
      style:display="flex"
      style:background="var(--iris-background)"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-md, 6px)"
      style:box-shadow="var(--iris-shadow-lg)"
      style:overflow="hidden"
    >
      {#each columns as col, colIdx (colIdx)}
        {#if colIdx > 0}
          <div style:width="1px" style:background="var(--iris-border)"></div>
        {/if}
        {#if virtual}
          <IrisVirtualScroll
            items={col}
            itemHeight={CASCADER_ROW_HEIGHT[size]}
            height={CASCADER_COLUMN_VIEWPORT}
            buffer={CASCADER_VIRTUAL_BUFFER}
            keyOf={(item) => (item as IrisCascaderNode).value}
            role="listbox"
            aria-label={t('cascader.level', { level: colIdx + 1 })}
            style="min-width: 140px"
          >
            {#snippet item(slotData)}
              {@const node = slotData.item as IrisCascaderNode}
              {@render optionItem(node, colIdx, true)}
            {/snippet}
          </IrisVirtualScroll>
        {:else}
          <ul
            role="listbox"
            aria-label={t('cascader.level', { level: colIdx + 1 })}
            style:min-width="140px"
            style:max-height="240px"
            style:overflow-y="auto"
            style:margin="0"
            style:padding="4px"
            style:list-style="none"
            style:padding-inline-start="0"
            style:margin-block="0"
          >
            {#each col as node (node.value)}
              {@render optionItem(node, colIdx, false)}
            {/each}
          </ul>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<!-- Shared option renderer — used by BOTH the plain and the virtual column
     paths so the a11y attribute surface is structurally identical. When
     virtual, the virtualizer pins each row's height, so the option fills the
     row (height 100% + border-box keeps the padding inside it). -->
{#snippet optionItem(node: IrisCascaderNode, colIdx: number, fill: boolean)}
  {@const isActive = activePath[colIdx] === node.value}
  {@const hasChildren = node.children !== undefined && node.children.length > 0}
  <li
    role="option"
    aria-selected={isActive}
    aria-disabled={node.disabled ? 'true' : undefined}
    data-iris-cascader-item
    data-state={isActive ? 'selected' : 'idle'}
    onclick={() => selectOption(colIdx, node)}
    onkeydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectOption(colIdx, node)
      }
    }}
    tabindex={node.disabled ? -1 : 0}
    style:display="flex"
    style:align-items="center"
    style:justify-content="space-between"
    style:gap="8px"
    style:padding="var(--iris-space-xs, 8px) var(--iris-padding-md, 12px)"
    style:cursor={node.disabled ? 'not-allowed' : 'pointer'}
    style:border-radius="var(--iris-radius-sm, 4px)"
    style:background={isActive ? 'var(--iris-surface-hover)' : 'transparent'}
    style:color={node.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)'}
    style:font-size={sz.fontSize}
    style:opacity={node.disabled ? '0.5' : '1'}
    style:height={fill ? '100%' : undefined}
    style:box-sizing={fill ? 'border-box' : undefined}
  >
    <span>{node.label}</span>
    {#if hasChildren}
      <span aria-hidden="true" style:font-size="10px">›</span>
    {/if}
  </li>
{/snippet}
