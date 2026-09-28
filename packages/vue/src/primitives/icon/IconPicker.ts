import { computed, defineComponent, h, ref, useId, watch, type PropType } from 'vue'
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

export interface IrisIconPickerProps {
  modelValue?: string
  defaultValue?: string
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
export const IrisIconPicker = defineComponent({
  name: 'IrisIconPicker',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: undefined },
    defaultValue: { type: String, default: '' },
    registry: { type: Object as PropType<IrisIconRegistry>, default: () => defaultIconRegistry },
    iconNames: { type: Array as PropType<readonly string[]>, default: undefined },
    categories: {
      type: Array as PropType<readonly IrisIconPickerCategory[]>,
      default: () => defaultIconPickerCategories,
    },
    columns: { type: Number, default: 6 },
    disabled: { type: Boolean, default: false },
    label: { type: String, default: undefined },
    searchLabel: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    emptyText: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_name: string) => true,
    valueChange: (_name: string) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const id = useId()
    const searchId = `${id}-search`
    const listboxId = `${id}-icons`
    const internalValue = ref(props.modelValue ?? props.defaultValue)
    const query = ref('')
    const categoryId = ref(ALL_CATEGORY)
    const activeIndex = ref(0)
    const searchElement = ref<HTMLInputElement | null>(null)
    const optionElements = ref<Array<HTMLButtonElement | null>>([])
    const categoryElements = ref<Array<HTMLButtonElement | null>>([])

    watch(
      () => props.modelValue,
      (name) => {
        if (name !== undefined) internalValue.value = name
      },
      { flush: 'sync' },
    )

    const currentValue = computed(() => props.modelValue ?? internalValue.value)
    const icons = computed(() =>
      [...new Set(props.iconNames ?? props.registry.list())].flatMap((name) => {
        const icon = props.registry.resolve(name)
        return icon ? [{ name, icon }] : []
      }),
    )
    const categoryIds = computed(() =>
      icons.value.map(({ name }) => getIconPickerCategoryId(name, props.categories)),
    )
    const visibleCategories = computed(() => {
      const available = new Set(categoryIds.value)
      const result = props.categories.filter((category) => available.has(category.id))
      if (available.has('other') && !result.some((category) => category.id === 'other')) {
        result.push(OTHER_CATEGORY)
      }
      return result
    })
    const effectiveCategory = computed(() =>
      categoryId.value === ALL_CATEGORY ||
      visibleCategories.value.some((c) => c.id === categoryId.value)
        ? categoryId.value
        : ALL_CATEGORY,
    )
    const filtered = computed(() =>
      icons.value.filter(
        ({ name }, index) =>
          (effectiveCategory.value === ALL_CATEGORY ||
            categoryIds.value[index] === effectiveCategory.value) &&
          matchesIconPickerQuery(name, query.value),
      ),
    )
    const columnCount = computed(() =>
      Number.isFinite(props.columns) ? Math.max(1, Math.min(12, Math.trunc(props.columns))) : 6,
    )
    const active = computed(() =>
      Math.min(activeIndex.value, Math.max(0, filtered.value.length - 1)),
    )
    const resolvedLabel = computed(
      () => props.label ?? String(attrs['aria-label'] ?? t('iconPicker.label')),
    )
    const resolvedSearchLabel = computed(() => props.searchLabel ?? t('iconPicker.search'))
    const resolvedPlaceholder = computed(() => props.placeholder ?? t('iconPicker.placeholder'))
    const resolvedEmptyText = computed(() => props.emptyText ?? t('iconPicker.empty'))

    watch([query, effectiveCategory, icons], () => {
      activeIndex.value = 0
    })

    const choose = (name: string) => {
      if (props.disabled) return
      if (props.modelValue === undefined) internalValue.value = name
      emit('update:modelValue', name)
      emit('valueChange', name)
    }
    const focusOption = (next: number) => {
      if (filtered.value.length === 0) return
      const index = Math.max(0, Math.min(filtered.value.length - 1, next))
      activeIndex.value = index
      optionElements.value[index]?.focus()
    }
    const onSearchKeydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' && filtered.value.length > 0) {
        event.preventDefault()
        focusOption(0)
      } else if (event.key === 'ArrowUp' && filtered.value.length > 0) {
        event.preventDefault()
        focusOption(filtered.value.length - 1)
      }
    }
    const onOptionKeydown = (event: KeyboardEvent, index: number) => {
      let next: number | undefined
      switch (event.key) {
        case 'ArrowRight':
          next = index + 1
          break
        case 'ArrowLeft':
          next = index - 1
          break
        case 'ArrowDown':
          next = index + columnCount.value
          break
        case 'ArrowUp':
          next = index - columnCount.value
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = filtered.value.length - 1
          break
        case 'Escape':
          event.preventDefault()
          searchElement.value?.focus()
          return
        default:
          return
      }
      event.preventDefault()
      focusOption(next)
    }
    const onCategoryKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLButtonElement
      const index = categoryElements.value.indexOf(target)
      if (index < 0) return
      let next: number | undefined
      const count = visibleCategories.value.length + 1
      if (event.key === 'ArrowRight') next = (index + 1) % count
      else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = count - 1
      if (next === undefined) return
      event.preventDefault()
      categoryId.value = next === 0 ? ALL_CATEGORY : visibleCategories.value[next - 1]!.id
      activeIndex.value = 0
      categoryElements.value[next]?.focus()
    }
    const categoryLabel = (category: IrisIconPickerCategory) => {
      if (category.label) return category.label
      const key = `iconPicker.category.${category.id}`
      const translated = t(key)
      return translated === key
        ? category.id.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
        : translated
    }
    const categoryStyle = (selected: boolean) => ({
      flex: '0 0 auto',
      padding: '5px 10px',
      color: selected
        ? 'var(--iris-primary-foreground, var(--iris-background))'
        : 'var(--iris-foreground)',
      background: selected ? 'var(--iris-primary)' : 'transparent',
      border: `1px solid ${selected ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
      borderRadius: 'var(--iris-radius-full, 999px)',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? 0.6 : 1,
      font: 'inherit',
      fontSize: 'var(--iris-font-size-xs, 12px)',
      whiteSpace: 'nowrap',
    })
    const renderCategory = (category: IrisIconPickerCategory | null, index: number) => {
      const id = category?.id ?? ALL_CATEGORY
      const selected = effectiveCategory.value === id
      return h(
        'button',
        {
          key: id,
          ref: (element: unknown) => {
            categoryElements.value[index] = element as HTMLButtonElement | null
          },
          type: 'button',
          'aria-controls': listboxId,
          'aria-pressed': selected,
          tabindex: selected ? 0 : -1,
          disabled: props.disabled,
          'data-iris-icon-picker-category': category?.id ?? 'all',
          style: categoryStyle(selected),
          onClick: () => {
            categoryId.value = id
            activeIndex.value = 0
          },
        },
        category ? categoryLabel(category) : t('iconPicker.all'),
      )
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          role: 'group',
          'aria-label': resolvedLabel.value,
          'data-iris-icon-picker': '',
          'data-disabled': props.disabled ? 'true' : undefined,
          style: [
            {
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--iris-space-sm, 12px)',
              padding: 'var(--iris-padding-md, 12px)',
              color: 'var(--iris-foreground)',
              background: 'var(--iris-surface)',
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-md, 6px)',
            },
            attrs.style,
          ],
        },
        [
          h('input', {
            ref: searchElement,
            id: searchId,
            type: 'search',
            value: query.value,
            placeholder: resolvedPlaceholder.value,
            'aria-label': resolvedSearchLabel.value,
            'aria-controls': listboxId,
            disabled: props.disabled,
            'data-iris-icon-picker-search': '',
            style: {
              boxSizing: 'border-box',
              width: '100%',
              minHeight: '36px',
              padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
              color: 'inherit',
              background: 'var(--iris-background)',
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              font: 'inherit',
              opacity: props.disabled ? 0.6 : 1,
            },
            onInput: (event: Event) => {
              query.value = (event.target as HTMLInputElement).value
              activeIndex.value = 0
            },
            onKeydown: onSearchKeydown,
          }),
          h(
            'div',
            {
              role: 'toolbar',
              tabindex: -1,
              'aria-label': t('iconPicker.categories'),
              'data-iris-icon-picker-categories': '',
              onKeydown: onCategoryKeydown,
              style: { display: 'flex', gap: '6px', overflowX: 'auto', paddingBlock: '2px' },
            },
            [
              renderCategory(null, 0),
              ...visibleCategories.value.map((category, index) =>
                renderCategory(category, index + 1),
              ),
            ],
          ),
          h(
            'div',
            {
              id: listboxId,
              role: 'listbox',
              'aria-label': resolvedLabel.value,
              'aria-disabled': props.disabled ? 'true' : undefined,
              'data-iris-icon-picker-grid': '',
              style: {
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount.value}, minmax(0, 1fr))`,
                gap: '6px',
                maxHeight: '280px',
                overflowY: 'auto',
                padding: '2px',
              },
            },
            filtered.value.length === 0
              ? [
                  h(
                    'div',
                    {
                      role: 'status',
                      'data-iris-icon-picker-empty': '',
                      style: {
                        gridColumn: '1 / -1',
                        padding: '20px',
                        color: 'var(--iris-muted)',
                        textAlign: 'center',
                      },
                    },
                    resolvedEmptyText.value,
                  ),
                ]
              : filtered.value.map(({ name, icon }, index) => {
                  const selected = currentValue.value === name
                  return h(
                    'button',
                    {
                      key: name,
                      ref: (element: unknown) => {
                        optionElements.value[index] = element as HTMLButtonElement | null
                      },
                      type: 'button',
                      role: 'option',
                      'aria-label': name,
                      'aria-selected': selected,
                      tabindex: index === active.value ? 0 : -1,
                      disabled: props.disabled,
                      'data-iris-icon-picker-option': name,
                      'data-state': selected ? 'selected' : 'idle',
                      style: {
                        minWidth: 0,
                        minHeight: '64px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '6px 4px',
                        color: 'inherit',
                        background: selected
                          ? 'var(--iris-surface-hover, var(--iris-background))'
                          : 'transparent',
                        border: `1px solid ${selected ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
                        borderRadius: 'var(--iris-radius-sm, 4px)',
                        cursor: props.disabled ? 'not-allowed' : 'pointer',
                        opacity: props.disabled ? 0.6 : 1,
                        font: 'inherit',
                      },
                      onFocus: () => {
                        activeIndex.value = index
                      },
                      onClick: () => choose(name),
                      onKeydown: (event: KeyboardEvent) => onOptionKeydown(event, index),
                    },
                    [
                      h(IrisIcon, { name, registry: props.registry, size: 22 }),
                      h(
                        'span',
                        {
                          style: {
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'var(--iris-font-size-xs, 12px)',
                          },
                        },
                        icon.name,
                      ),
                    ],
                  )
                }),
          ),
        ],
      )
  },
})
