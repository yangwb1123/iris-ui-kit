import { defineComponent, h, type PropType } from 'vue'

export type IrisDescriptionsLayout = 'horizontal' | 'vertical'

export interface IrisDescriptionsItem {
  key?: string | number
  label: string | number
  value: string | number
}

/**
 * Description list: a semantic `<dl>` rendering label/value pairs in a grid.
 * `columns` controls pairs-per-row, `layout` places the label beside or above
 * the value, and `bordered` draws a boxed style with separators. RTL-safe via
 * logical properties.
 */
export const IrisDescriptions = defineComponent({
  name: 'IrisDescriptions',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<IrisDescriptionsItem[]>, default: () => [] },
    /** Number of label/value pairs per row. */
    columns: { type: Number, default: 1 },
    /** `horizontal` = label beside value; `vertical` = label above value. */
    layout: { type: String as PropType<IrisDescriptionsLayout>, default: 'horizontal' },
    /** Boxed style with cell separators. */
    bordered: { type: Boolean, default: false },
  },
  setup(props, { attrs }) {
    return () => {
      const horizontal = props.layout === 'horizontal'
      const pad = props.bordered ? '8px 12px' : undefined
      const labelStyle: Record<string, string | undefined> = {
        margin: '0',
        fontSize: '13px',
        fontWeight: '500',
        color: 'var(--iris-muted)',
        padding: pad,
        ...(props.bordered ? { background: 'var(--iris-surface)' } : null),
      }
      const valueStyle: Record<string, string | undefined> = {
        margin: '0',
        fontSize: '14px',
        color: 'var(--iris-foreground)',
        padding: pad,
      }

      return h(
        'dl',
        {
          ...attrs,
          'data-iris-descriptions': '',
          'data-layout': props.layout,
          style: {
            display: 'grid',
            gridTemplateColumns: horizontal
              ? `repeat(${props.columns}, max-content 1fr)`
              : `repeat(${props.columns}, 1fr)`,
            gap: props.bordered ? '0' : horizontal ? '8px 16px' : '12px',
            margin: '0',
            ...(props.bordered
              ? {
                  border: '1px solid var(--iris-border)',
                  borderRadius: 'var(--iris-radius-md, 6px)',
                  overflow: 'hidden',
                }
              : null),
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        props.items.flatMap((item, i) => {
          const rowBorder =
            props.bordered && i >= props.columns ? '1px solid var(--iris-border)' : undefined
          if (horizontal) {
            return [
              h(
                'dt',
                {
                  key: `${item.key ?? i}-l`,
                  'data-iris-descriptions-label': '',
                  style: {
                    ...labelStyle,
                    borderBlockStart: rowBorder,
                    borderInlineEnd: props.bordered ? '1px solid var(--iris-border)' : undefined,
                  },
                },
                String(item.label),
              ),
              h(
                'dd',
                {
                  key: `${item.key ?? i}-v`,
                  'data-iris-descriptions-value': '',
                  style: { ...valueStyle, borderBlockStart: rowBorder },
                },
                String(item.value),
              ),
            ]
          }
          return [
            h(
              'div',
              {
                key: item.key ?? i,
                'data-iris-descriptions-item': '',
                style: {
                  borderBlockStart: rowBorder,
                  borderInlineStart:
                    props.bordered && i % props.columns !== 0
                      ? '1px solid var(--iris-border)'
                      : undefined,
                },
              },
              [
                h(
                  'dt',
                  { 'data-iris-descriptions-label': '', style: labelStyle },
                  String(item.label),
                ),
                h(
                  'dd',
                  { 'data-iris-descriptions-value': '', style: valueStyle },
                  String(item.value),
                ),
              ],
            ),
          ]
        }),
      )
    }
  },
})
