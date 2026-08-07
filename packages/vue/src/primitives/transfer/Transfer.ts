import { computed, defineComponent, h, onBeforeUnmount, ref, shallowRef, type PropType } from 'vue'
import { createSelectionModel } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'

export interface IrisTransferItem {
  label: string
  value: string
  disabled?: boolean
}

type Side = 'source' | 'target'

/**
 * Dual-list transfer: move items between an "available" and a "selected" pane
 * via per-item checkboxes and the ›/‹ buttons. `v-model` binds the selected
 * values, with optional per-pane search and a select-all header. Built on
 * native checkboxes for accessibility.
 */
export const IrisTransfer = defineComponent({
  name: 'IrisTransfer',
  inheritAttrs: false,
  props: {
    options: { type: Array as PropType<IrisTransferItem[]>, default: () => [] },
    /** Values currently in the target (selected) pane. */
    modelValue: { type: Array as PropType<string[]>, default: () => [] },
    /** Pane titles: [available, selected]. */
    titles: { type: Array as PropType<string[]>, default: undefined },
    /** Show a search box per pane. */
    searchable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_values: string[]) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    // Each pane's checkbox set is single-sourced through the core selection model
    // (multiple-select toggle + dedup + select-all); only the ›/‹ move actions
    // emit `modelValue`, so these models stay purely internal (no onChange).
    const sourceModel = createSelectionModel<string>({ mode: 'multiple' })
    const targetModel = createSelectionModel<string>({ mode: 'multiple' })
    const sourceSel = shallowRef<string[]>(sourceModel.get())
    const targetSel = shallowRef<string[]>(targetModel.get())
    onBeforeUnmount(
      sourceModel.store.subscribe((keys) => {
        sourceSel.value = keys
      }),
    )
    onBeforeUnmount(
      targetModel.store.subscribe((keys) => {
        targetSel.value = keys
      }),
    )
    const sourceQuery = ref('')
    const targetQuery = ref('')

    const value = computed(() => props.modelValue ?? [])
    const valueSet = computed(() => new Set(value.value))
    const sourceItems = computed(() => props.options.filter((o) => !valueSet.value.has(o.value)))
    const targetItems = computed(() => props.options.filter((o) => valueSet.value.has(o.value)))

    const moveToTarget = () => {
      if (props.disabled) return
      const moving = sourceItems.value.filter((o) => !o.disabled && sourceModel.isSelected(o.value))
      if (moving.length === 0) return
      emit('update:modelValue', [...value.value, ...moving.map((o) => o.value)])
      sourceModel.clear()
    }
    const moveToSource = () => {
      if (props.disabled) return
      const removing = new Set(
        targetItems.value
          .filter((o) => !o.disabled && targetModel.isSelected(o.value))
          .map((o) => o.value),
      )
      if (removing.size === 0) return
      emit(
        'update:modelValue',
        value.value.filter((v) => !removing.has(v)),
      )
      targetModel.clear()
    }

    const paneStyle: Record<string, string> = {
      display: 'flex',
      flexDirection: 'column',
      width: '220px',
      border: '1px solid var(--iris-border)',
      borderRadius: 'var(--iris-radius-md, 6px)',
      background: 'var(--iris-background)',
      overflow: 'hidden',
    }
    const moveBtnStyle: Record<string, string> = {
      width: '32px',
      height: '28px',
      border: '1px solid var(--iris-border)',
      borderRadius: 'var(--iris-radius-sm, 4px)',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      cursor: 'pointer',
      fontSize: 'var(--iris-font-size-lg, 16px)',
      lineHeight: '1',
    }

    const renderPane = (side: Side) => {
      const items = (side === 'source' ? sourceItems : targetItems).value
      const model = side === 'source' ? sourceModel : targetModel
      const checked = new Set(side === 'source' ? sourceSel.value : targetSel.value)
      const queryRef = side === 'source' ? sourceQuery : targetQuery
      const query = queryRef.value
      const visible = query
        ? items.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
        : items
      const selectable = visible.filter((o) => !o.disabled)
      const allChecked = selectable.length > 0 && selectable.every((o) => checked.has(o.value))
      const someChecked = selectable.some((o) => checked.has(o.value))
      const checkedCount = items.filter((o) => checked.has(o.value)).length

      const toggle = (v: string) => model.toggle(v)
      const toggleAll = () => {
        if (allChecked) model.clear()
        else model.set(selectable.map((o) => o.value))
      }

      return h('div', { 'data-iris-transfer-pane': '', 'data-side': side, style: paneStyle }, [
        h(
          'div',
          {
            'data-iris-transfer-header': '',
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--iris-space-xs, 8px)',
              padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
              borderBlockEnd: '1px solid var(--iris-border)',
              fontSize: 'var(--iris-font-size-sm, 13px)',
              fontWeight: '500',
            },
          },
          [
            h(
              'label',
              {
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--iris-space-xs, 8px)',
                  minWidth: '0',
                },
              },
              [
                h('input', {
                  type: 'checkbox',
                  'data-iris-transfer-select-all': '',
                  checked: allChecked,
                  disabled: props.disabled || selectable.length === 0 || undefined,
                  ref: (el: unknown) => {
                    if (el) (el as HTMLInputElement).indeterminate = someChecked && !allChecked
                  },
                  onChange: toggleAll,
                }),
                h('span', props.titles?.[side === 'source' ? 0 : 1] ?? ''),
              ],
            ),
            h(
              'span',
              {
                'data-iris-transfer-count': '',
                style: { color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' },
              },
              `${checkedCount}/${items.length}`,
            ),
          ],
        ),
        props.searchable
          ? h('input', {
              type: 'search',
              'data-iris-transfer-search': '',
              'aria-label': t('transfer.search'),
              placeholder: t('transfer.search'),
              value: query,
              disabled: props.disabled || undefined,
              onInput: (e: Event) => {
                queryRef.value = (e.target as HTMLInputElement).value
              },
              style: {
                margin: 'var(--iris-space-xs, 8px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
                background: 'var(--iris-background)',
                color: 'var(--iris-foreground)',
                outline: 'none',
              },
            })
          : null,
        h(
          'ul',
          {
            'data-iris-transfer-list': '',
            style: {
              listStyle: 'none',
              margin: '0',
              padding: '4px',
              maxHeight: '200px',
              overflowY: 'auto',
              flex: '1',
            },
          },
          visible.length === 0
            ? [
                h(
                  'li',
                  {
                    'data-iris-transfer-empty': '',
                    style: {
                      padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                      color: 'var(--iris-muted)',
                      fontSize: 'var(--iris-font-size-sm, 13px)',
                      textAlign: 'center',
                    },
                  },
                  t('transfer.empty'),
                ),
              ]
            : visible.map((o) =>
                h('li', { key: o.value, 'data-iris-transfer-item': '', 'data-value': o.value }, [
                  h(
                    'label',
                    {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                        borderRadius: 'var(--iris-radius-sm, 4px)',
                        cursor: o.disabled ? 'not-allowed' : 'pointer',
                        opacity: o.disabled ? '0.5' : '1',
                        fontSize: 'var(--iris-font-size-md, 14px)',
                      },
                    },
                    [
                      h('input', {
                        type: 'checkbox',
                        checked: checked.has(o.value),
                        disabled: props.disabled || o.disabled || undefined,
                        onChange: () => toggle(o.value),
                      }),
                      h('span', o.label),
                    ],
                  ),
                ]),
              ),
        ),
      ])
    }

    return () => {
      const canToTarget =
        !props.disabled &&
        sourceItems.value.some((o) => !o.disabled && sourceSel.value.includes(o.value))
      const canToSource =
        !props.disabled &&
        targetItems.value.some((o) => !o.disabled && targetSel.value.includes(o.value))

      return h(
        'div',
        {
          ...attrs,
          'data-iris-transfer': '',
          'data-disabled': props.disabled ? 'true' : undefined,
          style: {
            display: 'inline-flex',
            alignItems: 'stretch',
            gap: '12px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          renderPane('source'),
          h(
            'div',
            {
              'data-iris-transfer-controls': '',
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '8px',
              },
            },
            [
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-transfer-to-target': '',
                  'aria-label': t('transfer.toTarget'),
                  disabled: !canToTarget || undefined,
                  onClick: moveToTarget,
                  style: moveBtnStyle,
                },
                '›',
              ),
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-transfer-to-source': '',
                  'aria-label': t('transfer.toSource'),
                  disabled: !canToSource || undefined,
                  onClick: moveToSource,
                  style: moveBtnStyle,
                },
                '‹',
              ),
            ],
          ),
          renderPane('target'),
        ],
      )
    }
  },
})
