import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType, type VNode } from 'vue'
import { createKeyboardNav, type KeyboardNavController } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'

export type IrisCascaderSize = 'sm' | 'md' | 'lg'

export interface IrisCascaderNode {
  label: string
  value: string
  disabled?: boolean
  children?: IrisCascaderNode[]
}

const SIZE_MAP: Record<IrisCascaderSize, { padding: string; fontSize: string; minHeight: string }> =
  {
    sm: {
      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
      fontSize: 'var(--iris-font-size-xs, 12px)',
      minHeight: '28px',
    },
    md: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      minHeight: '34px',
    },
    lg: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
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

function pathLabels(options: IrisCascaderNode[], path: string[]): string[] {
  const labels: string[] = []
  let level = options
  for (const v of path) {
    const node = level.find((n) => n.value === v)
    if (!node) break
    labels.push(node.label)
    level = node.children ?? []
  }
  return labels
}

function buildColumns(options: IrisCascaderNode[], activePath: string[]): IrisCascaderNode[][] {
  const cols: IrisCascaderNode[][] = [options]
  let level = options
  for (const v of activePath) {
    const node = level.find((n) => n.value === v)
    if (!node || !node.children || node.children.length === 0) break
    level = node.children
    cols.push(level)
  }
  return cols
}

function firstEnabledIndex(options: IrisCascaderNode[]): number {
  return options.findIndex((node) => !node.disabled)
}

function initialFocusIndices(options: IrisCascaderNode[], path: string[]): number[] {
  return buildColumns(options, path).map((column, columnIndex) => {
    const selected = column.findIndex((node) => node.value === path[columnIndex] && !node.disabled)
    return selected >= 0 ? selected : firstEnabledIndex(column)
  })
}

/**
 * Cascader: a hierarchical select that drills down through columns — choosing a
 * branch reveals its children in the next column; choosing a leaf commits the
 * full path (`v-model`). Closes on leaf-select, Escape, or outside click.
 */
export const IrisCascader = defineComponent({
  name: 'IrisCascader',
  inheritAttrs: false,
  props: {
    options: { type: Array as PropType<IrisCascaderNode[]>, default: () => [] },
    modelValue: { type: Array as PropType<string[]>, default: () => [] },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    separator: { type: String, default: ' / ' },
    size: { type: String as PropType<IrisCascaderSize>, default: 'md' },
    virtual: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_path: string[]) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const open = ref(false)
    const focused = ref(false)
    const activePath = ref<string[]>([...props.modelValue])
    const hoveredValue = ref<string | null>(null)
    const focusedIndices = ref<number[]>([])
    const columnNavs = new Map<number, { controller: KeyboardNavController; count: number }>()
    let renderedColumns: IrisCascaderNode[][] = []
    let rootEl: HTMLElement | null = null

    const getRovingIndex = (columnIndex: number, column: IrisCascaderNode[]): number => {
      const focusedIndex = focusedIndices.value[columnIndex]
      if (focusedIndex !== undefined && !column[focusedIndex]?.disabled) return focusedIndex
      const selected = column.findIndex(
        (node) => node.value === activePath.value[columnIndex] && !node.disabled,
      )
      return selected >= 0 ? selected : firstEnabledIndex(column)
    }

    const setColumnFocus = (columnIndex: number, optionIndex: number): void => {
      if (focusedIndices.value[columnIndex] === optionIndex) return
      const next = [...focusedIndices.value]
      next[columnIndex] = optionIndex
      focusedIndices.value = next
    }

    const getColumnNav = (
      columnIndex: number,
      column: IrisCascaderNode[],
    ): KeyboardNavController => {
      let entry = columnNavs.get(columnIndex)
      if (!entry) {
        entry = {
          controller: createKeyboardNav({
            count: column.length,
            initialIndex: getRovingIndex(columnIndex, column),
            isEnabled: (index) => !renderedColumns[columnIndex]?.[index]?.disabled,
          }),
          count: column.length,
        }
        columnNavs.set(columnIndex, entry)
      } else if (entry.count !== column.length) {
        entry.controller.reset(column.length)
        entry.count = column.length
      }
      const current = getRovingIndex(columnIndex, column)
      if (current >= 0) entry.controller.focus(current)
      return entry.controller
    }

    const focusColumnOption = (columnIndex: number, optionIndex: number): void => {
      const column = rootEl?.querySelector<HTMLElement>(
        `[data-iris-cascader-column][data-level="${columnIndex}"]`,
      )
      column
        ?.querySelector<HTMLElement>(
          `[data-iris-cascader-option][data-iris-cascader-index="${optionIndex}"]`,
        )
        ?.focus()
    }

    const toggleOpen = () => {
      if (props.disabled) return
      if (!open.value) {
        activePath.value = [...props.modelValue]
        focusedIndices.value = initialFocusIndices(props.options, props.modelValue)
      }
      open.value = !open.value
    }

    const selectOption = (colIndex: number, node: IrisCascaderNode) => {
      if (node.disabled) return
      const nextPath = [...activePath.value.slice(0, colIndex), node.value]
      activePath.value = nextPath
      const hasChildren = !!node.children && node.children.length > 0
      if (!hasChildren) {
        emit('update:modelValue', nextPath)
        open.value = false
      }
    }

    const onDocDown = (e: MouseEvent) => {
      if (open.value && rootEl && !rootEl.contains(e.target as Node)) open.value = false
    }
    onMounted(() => document.addEventListener('mousedown', onDocDown))
    onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))

    return () => {
      const sz = SIZE_MAP[props.size]
      const columns = buildColumns(props.options, activePath.value)
      renderedColumns = columns
      const labels = pathLabels(props.options, props.modelValue)
      const borderColor = props.invalid
        ? 'var(--iris-danger)'
        : focused.value || open.value
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'

      // Shared option renderer — used by BOTH the plain and the virtual column
      // paths so the a11y attribute surface is structurally identical. When
      // virtual, the virtualizer pins each row's height, so the option fills
      // the row (height 100% + border-box keeps the padding inside it).
      const renderOption = (ci: number, node: IrisCascaderNode, optionIndex: number): VNode => {
        const column = columns[ci] ?? []
        const isActive = activePath.value[ci] === node.value
        const hasChildren = !!node.children && node.children.length > 0
        const rovingIndex = getRovingIndex(ci, column)
        return h(
          'li',
          {
            key: node.value,
            role: 'option',
            tabindex: node.disabled ? -1 : rovingIndex === optionIndex ? 0 : -1,
            'aria-selected': isActive ? 'true' : 'false',
            'aria-disabled': node.disabled ? 'true' : undefined,
            'data-iris-cascader-option': '',
            'data-iris-cascader-index': optionIndex,
            'data-value': node.value,
            onClick: () => {
              if (node.disabled) return
              setColumnFocus(ci, optionIndex)
              getColumnNav(ci, column).focus(optionIndex)
              selectOption(ci, node)
            },
            onFocus: () => {
              if (node.disabled) return
              setColumnFocus(ci, optionIndex)
              getColumnNav(ci, column).focus(optionIndex)
            },
            onKeydown: (event: KeyboardEvent) => {
              const nav = getColumnNav(ci, column)
              nav.focus(optionIndex)
              const action = nav.handleKeyDown({
                key: event.key,
                preventDefault: () => event.preventDefault(),
              })
              if (action.type === 'focus' || action.type === 'typeahead') {
                setColumnFocus(ci, action.target)
                focusColumnOption(ci, action.target)
              } else if (action.type === 'select') {
                const target = column[action.target]
                if (target && !target.disabled) {
                  setColumnFocus(ci, action.target)
                  selectOption(ci, target)
                }
              }
            },
            onMouseenter: () => {
              hoveredValue.value = node.value
            },
            onMouseleave: () => {
              if (hoveredValue.value === node.value) hoveredValue.value = null
            },
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
              fontSize: sz.fontSize,
              borderRadius: 'var(--iris-radius-sm, 4px)',
              cursor: node.disabled ? 'not-allowed' : 'pointer',
              color: node.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
              background:
                isActive || hoveredValue.value === node.value
                  ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                  : 'transparent',
              ...(props.virtual ? { height: '100%', boxSizing: 'border-box' } : null),
            },
          },
          [
            h('span', node.label),
            hasChildren
              ? h(
                  'span',
                  {
                    'aria-hidden': 'true',
                    style: {
                      color: 'var(--iris-muted)',
                      fontSize: 'var(--iris-font-size-xs, 12px)',
                    },
                  },
                  '›',
                )
              : null,
          ],
        )
      }

      const columnStyle = (ci: number): Record<string, string | undefined> => ({
        minWidth: '140px',
        borderInlineStart: ci > 0 ? '1px solid var(--iris-border)' : undefined,
      })

      return h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            rootEl = (el ?? null) as HTMLElement | null
          },
          'data-iris-cascader': '',
          'data-state': open.value ? 'open' : 'closed',
          style: {
            position: 'relative',
            display: 'inline-block',
            minWidth: '240px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'button',
            {
              type: 'button',
              id: props.id,
              'data-iris-cascader-trigger': '',
              'aria-haspopup': 'listbox',
              'aria-expanded': open.value ? 'true' : 'false',
              'aria-invalid': props.invalid ? 'true' : undefined,
              'aria-describedby': props.ariaDescribedby,
              disabled: props.disabled || undefined,
              onClick: toggleOpen,
              onFocus: () => {
                focused.value = true
              },
              onBlur: () => {
                focused.value = false
              },
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === 'Escape' && open.value) {
                  e.preventDefault()
                  open.value = false
                } else if ((e.key === 'ArrowDown' || e.key === 'Enter') && !open.value) {
                  e.preventDefault()
                  toggleOpen()
                }
              },
              style: {
                boxSizing: 'border-box',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: sz.padding,
                minHeight: sz.minHeight,
                fontSize: sz.fontSize,
                fontFamily: 'inherit',
                textAlign: 'start',
                color: labels.length ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                background: 'var(--iris-background)',
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--iris-radius-md, 6px)',
                cursor: props.disabled ? 'not-allowed' : 'pointer',
                opacity: props.disabled ? '0.6' : '1',
                outline: 'none',
              },
            },
            [
              h(
                'span',
                { 'data-iris-cascader-value': '' },
                labels.length
                  ? labels.join(props.separator)
                  : (props.placeholder ?? t('select.placeholder')),
              ),
              h(
                'span',
                {
                  'aria-hidden': 'true',
                  style: { color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' },
                },
                '▾',
              ),
            ],
          ),
          open.value
            ? h(
                'div',
                {
                  'data-iris-cascader-panel': '',
                  style: {
                    position: 'absolute',
                    insetInlineStart: '0',
                    top: '100%',
                    marginBlockStart: '4px',
                    display: 'flex',
                    zIndex: '50',
                    background: 'var(--iris-background)',
                    border: '1px solid var(--iris-border)',
                    borderRadius: 'var(--iris-radius-md, 6px)',
                    boxShadow: 'var(--iris-shadow-lg)',
                    overflow: 'hidden',
                  },
                },
                columns.map((col, ci) =>
                  props.virtual
                    ? h(
                        IrisVirtualScroll,
                        {
                          key: ci,
                          items: col,
                          itemHeight: CASCADER_ROW_HEIGHT[props.size],
                          height: CASCADER_COLUMN_VIEWPORT,
                          buffer: CASCADER_VIRTUAL_BUFFER,
                          keyOf: (item: unknown) => (item as IrisCascaderNode).value,
                          role: 'listbox',
                          'aria-label': t('cascader.level', { level: ci + 1 }),
                          'data-iris-cascader-column': '',
                          'data-level': ci,
                          style: columnStyle(ci),
                        },
                        {
                          item: ({ item, index }: { item: unknown; index: number }) =>
                            renderOption(ci, item as IrisCascaderNode, index),
                        },
                      )
                    : h(
                        'ul',
                        {
                          key: ci,
                          role: 'listbox',
                          'aria-label': t('cascader.level', { level: ci + 1 }),
                          'data-iris-cascader-column': '',
                          'data-level': ci,
                          style: {
                            listStyle: 'none',
                            margin: '0',
                            padding: '4px',
                            ...columnStyle(ci),
                            maxHeight: '240px',
                            overflowY: 'auto',
                          },
                        },
                        col.map((node, optionIndex) => renderOption(ci, node, optionIndex)),
                      ),
                ),
              )
            : null,
        ],
      )
    }
  },
})
