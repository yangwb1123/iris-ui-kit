<script lang="ts">
  import { untrack } from 'svelte'
  import {
    defaultIconPickerCategories,
    defaultIconRegistry,
    getIconPickerCategoryId,
    matchesIconPickerQuery,
  } from '@iris-ui-kit/icons'
  import type { IrisIconPickerCategory } from '@iris-ui-kit/icons'
  import { useI18n } from '../../i18n'
  import { mergeStyle } from '../../internal/style'
  import IrisIcon from './IrisIcon.svelte'
  import type { IrisIconPickerProps } from './types'

  const ALL_CATEGORY = '__iris_all_icons__'
  const OTHER_CATEGORY: IrisIconPickerCategory = { id: 'other', iconNames: [] }

  let {
    value,
    defaultValue = '',
    onValueChange,
    registry = defaultIconRegistry,
    iconNames,
    categories = defaultIconPickerCategories,
    columns = 6,
    disabled = false,
    label,
    searchLabel,
    placeholder,
    emptyText,
    class: className,
    style,
    ...rest
  }: IrisIconPickerProps = $props()

  const { locale: i18nLocale, t: translate } = useI18n()
  let reactiveT = $state(translate)
  $effect(() => {
    const activeLocale = $i18nLocale
    reactiveT = (key: string) => {
      void activeLocale
      return translate(key)
    }
  })

  const id = $props.id()
  const searchId = `${id}-search`
  const listboxId = `${id}-icons`
  let internalValue = $state(untrack(() => value ?? defaultValue))
  let query = $state('')
  let categoryId = $state(ALL_CATEGORY)
  let activeIndex = $state(0)
  let searchElement = $state<HTMLInputElement | undefined>(undefined)
  let optionElements = $state<Array<HTMLButtonElement | undefined>>([])
  let categoryElements = $state<Array<HTMLButtonElement | undefined>>([])

  const currentValue = $derived(value !== undefined ? value : internalValue)
  const icons = $derived.by(() => {
    const names = [...new Set(iconNames ?? registry.list())]
    return names.flatMap((name) => {
      const icon = registry.resolve(name)
      return icon ? [{ name, icon }] : []
    })
  })
  const categoryIds = $derived(icons.map(({ name }) => getIconPickerCategoryId(name, categories)))
  const visibleCategories = $derived.by(() => {
    const available = new Set(categoryIds)
    const result = categories.filter((category) => available.has(category.id))
    if (available.has('other') && !result.some((category) => category.id === 'other')) {
      result.push(OTHER_CATEGORY)
    }
    return result
  })
  const effectiveCategory = $derived(
    categoryId === ALL_CATEGORY || visibleCategories.some((category) => category.id === categoryId)
      ? categoryId
      : ALL_CATEGORY,
  )
  const filtered = $derived.by(() =>
    icons.filter(
      ({ name }, index) =>
        (effectiveCategory === ALL_CATEGORY || categoryIds[index] === effectiveCategory) &&
        matchesIconPickerQuery(name, query),
    ),
  )
  const columnCount = $derived(
    Number.isFinite(columns) ? Math.max(1, Math.min(12, Math.trunc(columns))) : 6,
  )
  const active = $derived(Math.min(activeIndex, Math.max(0, filtered.length - 1)))
  let resolvedLabel = $derived(
    label ?? (rest['aria-label'] as string | undefined) ?? reactiveT('iconPicker.label'),
  )
  let resolvedSearchLabel = $derived(searchLabel ?? reactiveT('iconPicker.search'))
  let resolvedPlaceholder = $derived(placeholder ?? reactiveT('iconPicker.placeholder'))
  let resolvedEmptyText = $derived(emptyText ?? reactiveT('iconPicker.empty'))

  $effect(() => {
    if (value !== undefined) internalValue = value
  })
  $effect(() => {
    void query
    void effectiveCategory
    void icons
    activeIndex = 0
  })

  function categoryLabel(category: IrisIconPickerCategory): string {
    if (category.label) return category.label
    const key = `iconPicker.category.${category.id}`
    const translated = reactiveT(key)
    return translated === key
      ? category.id.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : translated
  }

  function choose(name: string): void {
    if (disabled) return
    if (value === undefined) internalValue = name
    onValueChange?.(name)
  }

  function focusOption(next: number): void {
    if (filtered.length === 0) return
    const index = Math.max(0, Math.min(filtered.length - 1, next))
    activeIndex = index
    optionElements[index]?.focus()
  }

  function onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' && filtered.length > 0) {
      event.preventDefault()
      focusOption(0)
    } else if (event.key === 'ArrowUp' && filtered.length > 0) {
      event.preventDefault()
      focusOption(filtered.length - 1)
    }
  }

  function onOptionKeydown(event: KeyboardEvent, index: number): void {
    let next: number | undefined
    switch (event.key) {
      case 'ArrowRight':
        next = index + 1
        break
      case 'ArrowLeft':
        next = index - 1
        break
      case 'ArrowDown':
        next = index + columnCount
        break
      case 'ArrowUp':
        next = index - columnCount
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = filtered.length - 1
        break
      case 'Escape':
        event.preventDefault()
        searchElement?.focus()
        return
      default:
        return
    }
    event.preventDefault()
    focusOption(next)
  }

  function onCategoryKeydown(event: KeyboardEvent): void {
    const index = categoryElements.indexOf(event.target as HTMLButtonElement)
    if (index < 0) return
    const count = visibleCategories.length + 1
    let next: number | undefined
    if (event.key === 'ArrowRight') next = (index + 1) % count
    else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    if (next === undefined) return
    event.preventDefault()
    setCategory(next === 0 ? ALL_CATEGORY : visibleCategories[next - 1]!.id)
    categoryElements[next]?.focus()
  }

  function setCategory(id: string): void {
    categoryId = id
    activeIndex = 0
  }
</script>

<div
  {...rest}
  role="group"
  aria-label={resolvedLabel}
  class={className}
  data-iris-icon-picker=""
  data-disabled={disabled ? 'true' : undefined}
  style={mergeStyle(
    'display: flex; flex-direction: column; gap: var(--iris-space-sm, 12px); padding: var(--iris-padding-md, 12px); color: var(--iris-foreground); background: var(--iris-surface); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px)',
    style,
  )}
>
  <input
    bind:this={searchElement}
    id={searchId}
    type="search"
    value={query}
    placeholder={resolvedPlaceholder}
    aria-label={resolvedSearchLabel}
    aria-controls={listboxId}
    {disabled}
    data-iris-icon-picker-search=""
    oninput={(event) => {
      query = event.currentTarget.value
      activeIndex = 0
    }}
    onkeydown={onSearchKeydown}
    style="box-sizing: border-box; width: 100%; min-height: 36px; padding: var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px); color: inherit; background: var(--iris-background); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-sm, 4px); font: inherit; opacity: {disabled
      ? 0.6
      : 1}"
  />
  <div
    role="toolbar"
    tabindex="-1"
    aria-label={reactiveT('iconPicker.categories')}
    data-iris-icon-picker-categories=""
    onkeydown={onCategoryKeydown}
    style="display: flex; gap: 6px; overflow-x: auto; padding-block: 2px"
  >
    <button
      bind:this={categoryElements[0]}
      type="button"
      aria-controls={listboxId}
      aria-pressed={effectiveCategory === ALL_CATEGORY}
      tabindex={effectiveCategory === ALL_CATEGORY ? 0 : -1}
      {disabled}
      data-iris-icon-picker-category="all"
      onclick={() => setCategory(ALL_CATEGORY)}
      style="flex: 0 0 auto; padding: 5px 10px; color: {effectiveCategory === ALL_CATEGORY
        ? 'var(--iris-primary-foreground, var(--iris-background))'
        : 'var(--iris-foreground)'}; background: {effectiveCategory === ALL_CATEGORY
        ? 'var(--iris-primary)'
        : 'transparent'}; border: 1px solid {effectiveCategory === ALL_CATEGORY
        ? 'var(--iris-primary)'
        : 'var(--iris-border)'}; border-radius: var(--iris-radius-full, 999px); cursor: {disabled
        ? 'not-allowed'
        : 'pointer'}; opacity: {disabled
        ? 0.6
        : 1}; font: inherit; font-size: var(--iris-font-size-xs, 12px); white-space: nowrap"
      >{reactiveT('iconPicker.all')}</button
    >
    {#each visibleCategories as category, index (category.id)}
      {@const selected = effectiveCategory === category.id}
      <button
        bind:this={categoryElements[index + 1]}
        type="button"
        aria-controls={listboxId}
        aria-pressed={selected}
        tabindex={selected ? 0 : -1}
        {disabled}
        data-iris-icon-picker-category={category.id}
        onclick={() => setCategory(category.id)}
        style="flex: 0 0 auto; padding: 5px 10px; color: {selected
          ? 'var(--iris-primary-foreground, var(--iris-background))'
          : 'var(--iris-foreground)'}; background: {selected
          ? 'var(--iris-primary)'
          : 'transparent'}; border: 1px solid {selected
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'}; border-radius: var(--iris-radius-full, 999px); cursor: {disabled
          ? 'not-allowed'
          : 'pointer'}; opacity: {disabled
          ? 0.6
          : 1}; font: inherit; font-size: var(--iris-font-size-xs, 12px); white-space: nowrap"
        >{categoryLabel(category)}</button
      >
    {/each}
  </div>
  <div
    id={listboxId}
    role="listbox"
    aria-label={resolvedLabel}
    aria-disabled={disabled ? 'true' : undefined}
    data-iris-icon-picker-grid=""
    style="display: grid; grid-template-columns: repeat({columnCount}, minmax(0, 1fr)); gap: 6px; max-height: 280px; overflow-y: auto; padding: 2px"
  >
    {#if filtered.length === 0}
      <div
        role="status"
        data-iris-icon-picker-empty=""
        style="grid-column: 1 / -1; padding: 20px; color: var(--iris-muted); text-align: center"
      >
        {resolvedEmptyText}
      </div>
    {:else}
      {#each filtered as { name, icon }, index (name)}
        {@const selected = currentValue === name}
        <button
          bind:this={optionElements[index]}
          type="button"
          role="option"
          aria-label={name}
          aria-selected={selected}
          tabindex={index === active ? 0 : -1}
          {disabled}
          data-iris-icon-picker-option={name}
          data-state={selected ? 'selected' : 'idle'}
          onfocus={() => {
            activeIndex = index
          }}
          onclick={() => choose(name)}
          onkeydown={(event) => onOptionKeydown(event, index)}
          style="min-width: 0; min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 6px 4px; color: inherit; background: {selected
            ? 'var(--iris-surface-hover, var(--iris-background))'
            : 'transparent'}; border: 1px solid {selected
            ? 'var(--iris-primary)'
            : 'var(--iris-border)'}; border-radius: var(--iris-radius-sm, 4px); cursor: {disabled
            ? 'not-allowed'
            : 'pointer'}; opacity: {disabled ? 0.6 : 1}; font: inherit"
        >
          <IrisIcon {name} {registry} size={22} />
          <span
            style="max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--iris-font-size-xs, 12px)"
            >{icon.name}</span
          >
        </button>
      {/each}
    {/if}
  </div>
</div>
