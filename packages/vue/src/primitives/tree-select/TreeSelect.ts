import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType, type VNode } from 'vue'
import { useI18n } from '../../i18n'

export type IrisTreeSelectSize = 'sm' | 'md' | 'lg'

export interface IrisTreeSelectNode {
  label: string
  value: string
  disabled?: boolean
  children?: IrisTreeSelectNode[]
}

const SIZE_MAP: Record<
  IrisTreeSelectSize,
  { padding: string; fontSize: string; minHeight: string }
> = {
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

function findNode(nodes: IrisTreeSelectNode[], value: string): IrisTreeSelectNode | undefined {
  for (const n of nodes) {
    if (n.value === value) return n
    if (n.children) {
      const found = findNode(n.children, value)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Hierarchical single-select: a trigger that opens a `role="tree"` dropdown
 * with expand/collapse toggles. Selecting a node updates `v-model` and closes.
 * Closes on select, Escape, or outside click.
 */
export const IrisTreeSelect = defineComponent({
  name: 'IrisTreeSelect',
  inheritAttrs: false,
  props: {
    options: { type: Array as PropType<IrisTreeSelectNode[]>, default: () => [] },
    modelValue: { type: String, default: '' },
    defaultExpanded: { type: Array as PropType<string[]>, default: () => [] },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    size: { type: String as PropType<IrisTreeSelectSize>, default: 'md' },
    id: { type: String, default: undefined },
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const open = ref(false)
    const focused = ref(false)
    const expanded = ref<Set<string>>(new Set(props.defaultExpanded))
    let rootEl: HTMLElement | null = null

    const selectNode = (node: IrisTreeSelectNode) => {
      if (node.disabled) return
      emit('update:modelValue', node.value)
      open.value = false
    }
    const toggleExpand = (v: string) => {
      const next = new Set(expanded.value)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      expanded.value = next
    }

    const onDocDown = (e: MouseEvent) => {
      if (open.value && rootEl && !rootEl.contains(e.target as Node)) open.value = false
    }
    onMounted(() => document.addEventListener('mousedown', onDocDown))
    onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))

    const renderNodes = (
      nodes: IrisTreeSelectNode[],
      depth: number,
      sz: { fontSize: string },
    ): VNode[] =>
      nodes.map((node) => {
        const hasChildren = !!node.children && node.children.length > 0
        const isExpanded = expanded.value.has(node.value)
        const isSelected = node.value === props.modelValue
        return h(
          'li',
          {
            key: node.value,
            role: 'treeitem',
            'aria-selected': isSelected ? 'true' : 'false',
            'aria-expanded': hasChildren ? (isExpanded ? 'true' : 'false') : undefined,
            'data-iris-tree-select-node': '',
            'data-value': node.value,
            style: { listStyle: 'none' },
          },
          [
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  paddingInlineStart: `${depth * 16 + 6}px`,
                  paddingInlineEnd: '6px',
                  paddingBlock: '4px',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  background: isSelected
                    ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                    : 'transparent',
                },
              },
              [
                hasChildren
                  ? h(
                      'button',
                      {
                        type: 'button',
                        'data-iris-tree-select-toggle': '',
                        'aria-label': isExpanded
                          ? t('treeSelect.collapse')
                          : t('treeSelect.expand'),
                        onClick: () => toggleExpand(node.value),
                        style: {
                          width: '16px',
                          padding: '0',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--iris-muted)',
                          fontSize: 'var(--iris-font-size-xs, 12px)',
                        },
                      },
                      isExpanded ? '▾' : '▸',
                    )
                  : h('span', { style: { width: '16px', display: 'inline-block' } }),
                h(
                  'span',
                  {
                    'data-iris-tree-select-label': '',
                    onClick: () => selectNode(node),
                    style: {
                      flex: '1',
                      cursor: node.disabled ? 'not-allowed' : 'pointer',
                      color: node.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                      fontWeight: isSelected ? '600' : '400',
                      fontSize: sz.fontSize,
                    },
                  },
                  node.label,
                ),
              ],
            ),
            hasChildren && isExpanded
              ? h(
                  'ul',
                  { role: 'group', style: { margin: '0', padding: '0' } },
                  renderNodes(node.children!, depth + 1, sz),
                )
              : null,
          ],
        )
      })

    return () => {
      const sz = SIZE_MAP[props.size]
      const selected = props.modelValue ? findNode(props.options, props.modelValue) : undefined
      const borderColor = props.invalid
        ? 'var(--iris-danger)'
        : focused.value || open.value
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'

      return h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            rootEl = (el ?? null) as HTMLElement | null
          },
          'data-iris-tree-select': '',
          'data-state': open.value ? 'open' : 'closed',
          style: {
            position: 'relative',
            display: 'inline-block',
            minWidth: '220px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'button',
            {
              type: 'button',
              id: props.id,
              'data-iris-tree-select-trigger': '',
              'aria-haspopup': 'tree',
              'aria-expanded': open.value ? 'true' : 'false',
              'aria-invalid': props.invalid ? 'true' : undefined,
              'aria-describedby': props.ariaDescribedby,
              disabled: props.disabled || undefined,
              onClick: () => {
                if (!props.disabled) open.value = !open.value
              },
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
                  open.value = true
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
                color: selected ? 'var(--iris-foreground)' : 'var(--iris-muted)',
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
                { 'data-iris-tree-select-value': '' },
                selected ? selected.label : (props.placeholder ?? t('select.placeholder')),
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
                'ul',
                {
                  role: 'tree',
                  'data-iris-tree-select-tree': '',
                  style: {
                    position: 'absolute',
                    insetInlineStart: '0',
                    insetInlineEnd: '0',
                    top: '100%',
                    marginBlockStart: '4px',
                    maxHeight: '280px',
                    overflowY: 'auto',
                    margin: '0',
                    padding: '4px',
                    zIndex: '50',
                    background: 'var(--iris-background)',
                    border: '1px solid var(--iris-border)',
                    borderRadius: 'var(--iris-radius-md, 6px)',
                    boxShadow: 'var(--iris-shadow-lg)',
                  },
                },
                renderNodes(props.options, 0, sz),
              )
            : null,
        ],
      )
    }
  },
})
