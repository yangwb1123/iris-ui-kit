<script lang="ts">
  import { useI18n } from '../../i18n'

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
    id?: string
    onValueChange?: (path: string[]) => void
    style?: string
    class?: string
  }

  const SIZE_MAP: Record<
    IrisCascaderSize,
    { padding: string; fontSize: string; minHeight: string }
  > = {
    sm: { padding: '4px 8px', fontSize: '12px', minHeight: '28px' },
    md: { padding: '6px 12px', fontSize: '14px', minHeight: '34px' },
    lg: { padding: '8px 12px', fontSize: '16px', minHeight: '40px' },
  }

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
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  let open = $state(false)
  let activePath = $state<string[]>([...value])
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
    {id}
    {disabled}
    aria-invalid={invalid ? 'true' : undefined}
    aria-expanded={open}
    aria-haspopup="listbox"
    data-iris-cascader-trigger
    onkeydown={onTriggerKeyDown}
    data-state={open ? 'open' : 'closed'}
    onclick={toggle}
    style:display="inline-flex"
    style:align-items="center"
    style:justify-content="space-between"
    style:gap="6px"
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
      data-iris-cascader-dropdown
      style:position="absolute"
      style:top="calc(100% + 4px)"
      style:left="0"
      style:z-index="50"
      style:display="flex"
      style:background="var(--iris-background)"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-md, 6px)"
      style:box-shadow="0 8px 24px rgba(0,0,0,0.12)"
      style:overflow="hidden"
    >
      {#each columns as col, colIdx (colIdx)}
        {#if colIdx > 0}
          <div style:width="1px" style:background="var(--iris-border)"></div>
        {/if}
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
            {@const isActive = activePath[colIdx] === node.value}
            <li
              role="option"
              aria-selected={isActive}
              aria-disabled={node.disabled ? 'true' : undefined}
              data-iris-cascader-item
              data-state={isActive ? 'selected' : 'idle'}
              onclick={() => selectOption(colIdx, node)}
              style:display="flex"
              style:align-items="center"
              style:justify-content="space-between"
              style:gap="8px"
              style:padding="7px 12px"
              style:cursor={node.disabled ? 'not-allowed' : 'pointer'}
              style:border-radius="var(--iris-radius-sm, 4px)"
              style:background={isActive ? 'var(--iris-surface-hover)' : 'transparent'}
              style:color={node.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)'}
              style:font-size={sz.fontSize}
              style:opacity={node.disabled ? '0.5' : '1'}
            >
              <span>{node.label}</span>
              {#if node.children && node.children.length > 0}
                <span aria-hidden="true" style:font-size="10px">›</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  {/if}
</div>
