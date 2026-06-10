<script lang="ts">
  import { createSelectionModel } from '@iris-ui/core'
  import { toStore } from '../../useStore'
  import { useI18n } from '../../i18n'

  export interface IrisTransferItem {
    label: string
    value: string
    disabled?: boolean
  }

  interface Props {
    options?: IrisTransferItem[]
    value?: string[]
    titles?: [string, string]
    searchable?: boolean
    disabled?: boolean
    onValueChange?: (values: string[]) => void
    style?: string
    class?: string
  }

  let {
    options = [],
    value = [],
    titles,
    searchable = false,
    disabled = false,
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  // Each panel's "checked" set is a core selection model (multiple mode). The
  // per-item toggle and select-all are single-sourced in the model; these sets
  // are internal-only (no onChange) — `value`/`onValueChange` still own the
  // target-list membership below.
  const sourceModel = createSelectionModel<string>({ mode: 'multiple' })
  const targetModel = createSelectionModel<string>({ mode: 'multiple' })
  const sourceChecked = toStore(sourceModel.store)
  const targetChecked = toStore(targetModel.store)
  let sourceQuery = $state('')
  let targetQuery = $state('')

  const valueSet = $derived(new Set(value))
  const sourceItems = $derived(options.filter((o) => !valueSet.has(o.value)))
  const targetItems = $derived(options.filter((o) => valueSet.has(o.value)))

  const filteredSource = $derived(
    searchable ? sourceItems.filter((o) => o.label.toLowerCase().includes(sourceQuery.toLowerCase())) : sourceItems
  )
  const filteredTarget = $derived(
    searchable ? targetItems.filter((o) => o.label.toLowerCase().includes(targetQuery.toLowerCase())) : targetItems
  )

  function moveToTarget() {
    if (disabled) return
    const moving = sourceItems.filter((o) => !o.disabled && sourceModel.isSelected(o.value))
    if (moving.length === 0) return
    onValueChange?.([...value, ...moving.map((o) => o.value)])
    sourceModel.clear()
  }

  function moveToSource() {
    if (disabled) return
    const removing = new Set(
      targetItems.filter((o) => !o.disabled && targetModel.isSelected(o.value)).map((o) => o.value)
    )
    if (removing.size === 0) return
    onValueChange?.(value.filter((v) => !removing.has(v)))
    targetModel.clear()
  }

  function toggleSource(val: string) {
    sourceModel.toggle(val)
  }

  function toggleTarget(val: string) {
    targetModel.toggle(val)
  }

  function toggleAllSource() {
    const eligible = filteredSource.filter((o) => !o.disabled).map((o) => o.value)
    const allChecked = eligible.length > 0 && eligible.every((v) => sourceModel.isSelected(v))
    if (allChecked) sourceModel.clear()
    else sourceModel.set(eligible)
  }

  function toggleAllTarget() {
    const eligible = filteredTarget.filter((o) => !o.disabled).map((o) => o.value)
    const allChecked = eligible.length > 0 && eligible.every((v) => targetModel.isSelected(v))
    if (allChecked) targetModel.clear()
    else targetModel.set(eligible)
  }

  const paneStyle = 'display:flex;flex-direction:column;width:220px;border:1px solid var(--iris-border);border-radius:var(--iris-radius-md,6px);background:var(--iris-background);overflow:hidden;'
</script>

<div
  data-iris-transfer
  data-disabled={disabled ? '' : undefined}
  style:display="flex"
  style:align-items="center"
  style:gap="12px"
  style={style}
  class={className}
  {...rest}
>
  <!-- Source pane -->
  <div data-iris-transfer-source style={paneStyle}>
    <div style:padding="8px 12px" style:border-bottom="1px solid var(--iris-border)" style:display="flex" style:align-items="center" style:gap="8px">
      <input
        type="checkbox"
        aria-label={t('transfer.selectAllSource')}
        checked={filteredSource.filter(o => !o.disabled).length > 0 && filteredSource.filter(o => !o.disabled).every(o => $sourceChecked.includes(o.value))}
        onchange={toggleAllSource}
        disabled={disabled}
      />
      <span style:font-size="13px" style:font-weight="600">{titles?.[0] ?? t('transfer.sourceTitle')}</span>
      <span style:margin-left="auto" style:font-size="12px" style:color="var(--iris-muted)">{$sourceChecked.length}/{filteredSource.length}</span>
    </div>
    {#if searchable}
      <div style:padding="6px 8px" style:border-bottom="1px solid var(--iris-border)">
        <input
          type="text"
          placeholder={t('transfer.search')}
          bind:value={sourceQuery}
          style:width="100%"
          style:border="none"
          style:outline="none"
          style:font-size="13px"
          style:background="transparent"
          style:color="var(--iris-foreground)"
        />
      </div>
    {/if}
    <div style:overflow-y="auto" style:flex="1" style:max-height="240px">
      {#each filteredSource as item (item.value)}
        <label
          style:display="flex"
          style:align-items="center"
          style:gap="8px"
          style:padding="6px 12px"
          style:cursor={item.disabled || disabled ? 'not-allowed' : 'pointer'}
          style:opacity={item.disabled ? '0.5' : '1'}
          style:font-size="13px"
          style:color="var(--iris-foreground)"
        >
          <input
            type="checkbox"
            checked={$sourceChecked.includes(item.value)}
            disabled={item.disabled || disabled}
            onchange={() => toggleSource(item.value)}
          />
          {item.label}
        </label>
      {/each}
      {#if filteredSource.length === 0}
        <div style:padding="12px" style:color="var(--iris-muted)" style:font-size="13px" style:text-align="center">{t('transfer.empty')}</div>
      {/if}
    </div>
  </div>

  <!-- Move buttons -->
  <div style:display="flex" style:flex-direction="column" style:gap="6px" style:align-items="center">
    <button
      type="button"
      aria-label={t('transfer.toTarget')}
      data-iris-transfer-move-right
      onclick={moveToTarget}
      disabled={disabled || $sourceChecked.length === 0}
      style:width="32px"
      style:height="32px"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-sm, 4px)"
      style:background="var(--iris-background)"
      style:cursor={disabled || $sourceChecked.length === 0 ? 'not-allowed' : 'pointer'}
      style:font-size="14px"
      style:opacity={disabled || $sourceChecked.length === 0 ? '0.5' : '1'}
    >›</button>
    <button
      type="button"
      aria-label={t('transfer.toSource')}
      data-iris-transfer-move-left
      onclick={moveToSource}
      disabled={disabled || $targetChecked.length === 0}
      style:width="32px"
      style:height="32px"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-sm, 4px)"
      style:background="var(--iris-background)"
      style:cursor={disabled || $targetChecked.length === 0 ? 'not-allowed' : 'pointer'}
      style:font-size="14px"
      style:opacity={disabled || $targetChecked.length === 0 ? '0.5' : '1'}
    >‹</button>
  </div>

  <!-- Target pane -->
  <div data-iris-transfer-target style={paneStyle}>
    <div style:padding="8px 12px" style:border-bottom="1px solid var(--iris-border)" style:display="flex" style:align-items="center" style:gap="8px">
      <input
        type="checkbox"
        aria-label={t('transfer.selectAllTarget')}
        checked={filteredTarget.filter(o => !o.disabled).length > 0 && filteredTarget.filter(o => !o.disabled).every(o => $targetChecked.includes(o.value))}
        onchange={toggleAllTarget}
        disabled={disabled}
      />
      <span style:font-size="13px" style:font-weight="600">{titles?.[1] ?? t('transfer.targetTitle')}</span>
      <span style:margin-left="auto" style:font-size="12px" style:color="var(--iris-muted)">{$targetChecked.length}/{filteredTarget.length}</span>
    </div>
    {#if searchable}
      <div style:padding="6px 8px" style:border-bottom="1px solid var(--iris-border)">
        <input
          type="text"
          placeholder={t('transfer.search')}
          bind:value={targetQuery}
          style:width="100%"
          style:border="none"
          style:outline="none"
          style:font-size="13px"
          style:background="transparent"
          style:color="var(--iris-foreground)"
        />
      </div>
    {/if}
    <div style:overflow-y="auto" style:flex="1" style:max-height="240px">
      {#each filteredTarget as item (item.value)}
        <label
          style:display="flex"
          style:align-items="center"
          style:gap="8px"
          style:padding="6px 12px"
          style:cursor={item.disabled || disabled ? 'not-allowed' : 'pointer'}
          style:opacity={item.disabled ? '0.5' : '1'}
          style:font-size="13px"
          style:color="var(--iris-foreground)"
        >
          <input
            type="checkbox"
            checked={$targetChecked.includes(item.value)}
            disabled={item.disabled || disabled}
            onchange={() => toggleTarget(item.value)}
          />
          {item.label}
        </label>
      {/each}
      {#if filteredTarget.length === 0}
        <div style:padding="12px" style:color="var(--iris-muted)" style:font-size="13px" style:text-align="center">{t('transfer.empty')}</div>
      {/if}
    </div>
  </div>
</div>
