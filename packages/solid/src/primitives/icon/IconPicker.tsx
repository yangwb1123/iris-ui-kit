import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  mergeProps,
  Show,
  splitProps,
  type JSX,
} from 'solid-js'
import {
  defaultIconPickerCategories,
  defaultIconRegistry,
  getIconPickerCategoryId,
  matchesIconPickerQuery,
  type IrisIconPickerCategory,
  type IrisIconRegistry,
} from '@iris-ui-kit/icons'
import { useI18n } from '../../i18n'
import { IrisIcon } from './Icon'

const ALL_CATEGORY = '__iris_all_icons__'
const OTHER_CATEGORY: IrisIconPickerCategory = { id: 'other', iconNames: [] }
const ROOT_STYLE =
  'display: flex; flex-direction: column; gap: var(--iris-space-sm, 12px); padding: var(--iris-padding-md, 12px); color: var(--iris-foreground); background: var(--iris-surface); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px)'

export interface IrisIconPickerProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string
  defaultValue?: string
  onValueChange?: (name: string) => void
  registry?: IrisIconRegistry
  iconNames?: readonly string[]
  categories?: readonly IrisIconPickerCategory[]
  columns?: number
  disabled?: boolean
  label?: string
  searchLabel?: string
  placeholder?: string
  emptyText?: string
}

/** Searchable, categorized semantic icon picker with roving keyboard navigation. */
export function IrisIconPicker(props: IrisIconPickerProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: '',
      registry: defaultIconRegistry,
      categories: defaultIconPickerCategories,
      columns: 6,
      disabled: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'onValueChange',
    'registry',
    'iconNames',
    'categories',
    'columns',
    'disabled',
    'label',
    'searchLabel',
    'placeholder',
    'emptyText',
    'class',
    'style',
    'aria-label',
  ])
  const { t } = useI18n()
  const id = createUniqueId()
  const listboxId = `${id}-icons`
  const [internalValue, setInternalValue] = createSignal(local.value ?? local.defaultValue)
  createEffect(() => {
    const accepted = local.value
    if (accepted !== undefined) setInternalValue(accepted)
  })
  const [query, setQuery] = createSignal('')
  const [categoryId, setCategoryId] = createSignal(ALL_CATEGORY)
  const [activeIndex, setActiveIndex] = createSignal(0)
  let searchElement: HTMLInputElement | undefined
  const optionElements: Array<HTMLButtonElement | undefined> = []
  const categoryElements: Array<HTMLButtonElement | undefined> = []

  const currentValue = () => (local.value !== undefined ? local.value : internalValue())
  const names = createMemo(() =>
    [...new Set(local.iconNames ?? local.registry.list())].filter(
      (name) => !!local.registry.resolve(name),
    ),
  )
  const icons = createMemo(() =>
    names().flatMap((name) => {
      const icon = local.registry.resolve(name)
      return icon ? [{ name, icon }] : []
    }),
  )
  const categoryIds = createMemo(() =>
    icons().map(({ name }) => getIconPickerCategoryId(name, local.categories)),
  )
  const visibleCategories = createMemo(() => {
    const available = new Set(categoryIds())
    const result = local.categories.filter((category) => available.has(category.id))
    if (available.has('other') && !result.some((category) => category.id === 'other')) {
      result.push(OTHER_CATEGORY)
    }
    return result
  })
  const effectiveCategory = () =>
    categoryId() === ALL_CATEGORY || visibleCategories().some((item) => item.id === categoryId())
      ? categoryId()
      : ALL_CATEGORY
  const filtered = createMemo(() =>
    icons().filter(
      ({ name }, index) =>
        (effectiveCategory() === ALL_CATEGORY || categoryIds()[index] === effectiveCategory()) &&
        matchesIconPickerQuery(name, query()),
    ),
  )
  createEffect(() => {
    void query()
    void effectiveCategory()
    void icons()
    setActiveIndex(0)
  })
  const columns = () =>
    Number.isFinite(local.columns) ? Math.max(1, Math.min(12, Math.trunc(local.columns))) : 6
  const active = () => Math.min(activeIndex(), Math.max(0, filtered().length - 1))
  const resolvedLabel = () => local.label ?? local['aria-label'] ?? t('iconPicker.label')
  const categoryLabel = (category: IrisIconPickerCategory) => {
    if (category.label) return category.label
    const key = `iconPicker.category.${category.id}`
    const translated = t(key)
    return translated === key
      ? category.id.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : translated
  }
  const categoryStyle = (selected: boolean): JSX.CSSProperties => ({
    flex: '0 0 auto',
    padding: '5px 10px',
    color: selected
      ? 'var(--iris-primary-foreground, var(--iris-background))'
      : 'var(--iris-foreground)',
    background: selected ? 'var(--iris-primary)' : 'transparent',
    border: `1px solid ${selected ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
    'border-radius': 'var(--iris-radius-full, 999px)',
    cursor: local.disabled ? 'not-allowed' : 'pointer',
    opacity: local.disabled ? 0.6 : 1,
    'font-size': 'var(--iris-font-size-xs, 12px)',
    'white-space': 'nowrap',
  })
  const focusOption = (next: number) => {
    if (!filtered().length) return
    const index = Math.max(0, Math.min(filtered().length - 1, next))
    setActiveIndex(index)
    optionElements[index]?.focus()
  }
  const onSearchKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' && filtered().length) {
      event.preventDefault()
      focusOption(0)
    } else if (event.key === 'ArrowUp' && filtered().length) {
      event.preventDefault()
      focusOption(filtered().length - 1)
    }
  }
  const onOptionKeyDown = (event: KeyboardEvent, index: number) => {
    let next: number | undefined
    switch (event.key) {
      case 'ArrowRight':
        next = index + 1
        break
      case 'ArrowLeft':
        next = index - 1
        break
      case 'ArrowDown':
        next = index + columns()
        break
      case 'ArrowUp':
        next = index - columns()
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = filtered().length - 1
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
  const onCategoryKeyDown = (event: KeyboardEvent) => {
    const index = categoryElements.indexOf(event.target as HTMLButtonElement)
    if (index < 0) return
    const count = visibleCategories().length + 1
    let next: number | undefined
    if (event.key === 'ArrowRight') next = (index + 1) % count
    else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    if (next === undefined) return
    event.preventDefault()
    setCategoryId(next === 0 ? ALL_CATEGORY : visibleCategories()[next - 1]!.id)
    setActiveIndex(0)
    categoryElements[next]?.focus()
  }
  const choose = (name: string) => {
    if (local.disabled) return
    if (local.value === undefined) setInternalValue(name)
    local.onValueChange?.(name)
  }

  return (
    <div
      {...rest}
      role="group"
      aria-label={resolvedLabel()}
      class={local.class}
      data-iris-icon-picker=""
      data-disabled={local.disabled ? 'true' : undefined}
      style={
        typeof local.style === 'string'
          ? `${ROOT_STYLE}; ${local.style}`
          : {
              display: 'flex',
              'flex-direction': 'column',
              gap: 'var(--iris-space-sm, 12px)',
              padding: 'var(--iris-padding-md, 12px)',
              color: 'var(--iris-foreground)',
              background: 'var(--iris-surface)',
              border: '1px solid var(--iris-border)',
              'border-radius': 'var(--iris-radius-md, 6px)',
              ...(local.style ?? {}),
            }
      }
    >
      <input
        ref={searchElement}
        type="search"
        value={query()}
        placeholder={local.placeholder ?? t('iconPicker.placeholder')}
        aria-label={local.searchLabel ?? t('iconPicker.search')}
        id={`${id}-search`}
        aria-controls={listboxId}
        disabled={local.disabled}
        data-iris-icon-picker-search=""
        onInput={(event) => {
          setQuery(event.currentTarget.value)
          setActiveIndex(0)
        }}
        onKeyDown={onSearchKeyDown}
        style={{
          'box-sizing': 'border-box',
          width: '100%',
          'min-height': '36px',
          padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
          color: 'inherit',
          background: 'var(--iris-background)',
          border: '1px solid var(--iris-border)',
          'border-radius': 'var(--iris-radius-sm, 4px)',
          'font-family': 'inherit',
          'font-size': 'inherit',
          opacity: local.disabled ? 0.6 : 1,
        }}
      />
      <div
        role="toolbar"
        tabIndex={-1}
        aria-label={t('iconPicker.categories')}
        data-iris-icon-picker-categories=""
        onKeyDown={onCategoryKeyDown}
        style={{ display: 'flex', gap: '6px', 'overflow-x': 'auto', 'padding-block': '2px' }}
      >
        <button
          ref={(element) => {
            categoryElements[0] = element
          }}
          type="button"
          aria-controls={listboxId}
          aria-pressed={effectiveCategory() === ALL_CATEGORY}
          tabIndex={effectiveCategory() === ALL_CATEGORY ? 0 : -1}
          disabled={local.disabled}
          data-iris-icon-picker-category="all"
          onClick={() => {
            setCategoryId(ALL_CATEGORY)
            setActiveIndex(0)
          }}
          style={categoryStyle(effectiveCategory() === ALL_CATEGORY)}
        >
          {t('iconPicker.all')}
        </button>
        <For each={visibleCategories()}>
          {(category, categoryIndex) => {
            const selected = () => effectiveCategory() === category.id
            const index = () => categoryIndex() + 1
            return (
              <button
                ref={(element) => {
                  categoryElements[index()] = element
                }}
                type="button"
                aria-controls={listboxId}
                aria-pressed={selected()}
                tabIndex={selected() ? 0 : -1}
                disabled={local.disabled}
                data-iris-icon-picker-category={category.id}
                onClick={() => {
                  setCategoryId(category.id)
                  setActiveIndex(0)
                }}
                style={categoryStyle(selected())}
              >
                {categoryLabel(category)}
              </button>
            )
          }}
        </For>
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-label={resolvedLabel()}
        aria-disabled={local.disabled ? 'true' : undefined}
        data-iris-icon-picker-grid=""
        style={{
          display: 'grid',
          'grid-template-columns': `repeat(${columns()}, minmax(0, 1fr))`,
          gap: '6px',
          'max-height': '280px',
          'overflow-y': 'auto',
          padding: '2px',
        }}
      >
        <Show when={filtered().length === 0}>
          <div
            role="status"
            data-iris-icon-picker-empty=""
            style={{
              'grid-column': '1 / -1',
              padding: '20px',
              color: 'var(--iris-muted)',
              'text-align': 'center',
            }}
          >
            {local.emptyText ?? t('iconPicker.empty')}
          </div>
        </Show>
        <For each={filtered()}>
          {({ name, icon }, index) => {
            const selected = () => currentValue() === name
            return (
              <button
                ref={(element) => {
                  optionElements[index()] = element
                }}
                type="button"
                role="option"
                aria-label={name}
                aria-selected={selected()}
                tabIndex={index() === active() ? 0 : -1}
                disabled={local.disabled}
                data-iris-icon-picker-option={name}
                data-state={selected() ? 'selected' : 'idle'}
                onFocus={() => setActiveIndex(index())}
                onClick={() => choose(name)}
                onKeyDown={(event) => onOptionKeyDown(event, index())}
                style={{
                  'min-width': '0',
                  'min-height': '64px',
                  display: 'flex',
                  'flex-direction': 'column',
                  'align-items': 'center',
                  'justify-content': 'center',
                  gap: '4px',
                  padding: '6px 4px',
                  color: 'inherit',
                  background: selected()
                    ? 'var(--iris-surface-hover, var(--iris-background))'
                    : 'transparent',
                  border: `1px solid ${selected() ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  cursor: local.disabled ? 'not-allowed' : 'pointer',
                  opacity: local.disabled ? 0.6 : 1,
                  'font-family': 'inherit',
                  'font-size': 'inherit',
                }}
              >
                <IrisIcon name={name} registry={local.registry} size={22} />
                <span
                  style={{
                    'max-width': '100%',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    'white-space': 'nowrap',
                    'font-size': 'var(--iris-font-size-xs, 12px)',
                  }}
                >
                  {icon.name}
                </span>
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}
