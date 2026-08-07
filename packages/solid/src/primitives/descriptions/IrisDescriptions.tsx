import { For, mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisDescriptionsLayout = 'horizontal' | 'vertical'

export interface IrisDescriptionsItem {
  key?: string | number
  label: string | number
  value: string | number
}

export interface IrisDescriptionsProps extends JSX.HTMLAttributes<HTMLDListElement> {
  items?: IrisDescriptionsItem[]
  /** Number of label/value pairs per row. */
  columns?: number
  /** `horizontal` = label beside value; `vertical` = label above value. */
  layout?: IrisDescriptionsLayout
  /** Boxed style with cell separators. */
  bordered?: boolean
}

/**
 * Description list: a semantic <dl> rendering label/value pairs in a grid.
 * `columns` controls pairs-per-row, `layout` places the label beside or above
 * the value, and `bordered` draws a boxed style with separators.
 */
export function IrisDescriptions(props: IrisDescriptionsProps): JSX.Element {
  const merged = mergeProps(
    {
      items: [] as IrisDescriptionsItem[],
      columns: 1,
      layout: 'horizontal' as IrisDescriptionsLayout,
      bordered: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, ['items', 'columns', 'layout', 'bordered', 'style'])

  const horizontal = () => local.layout === 'horizontal'
  const pad = () => (local.bordered ? '8px 12px' : undefined)

  const labelStyle = (): JSX.CSSProperties => ({
    margin: '0',
    'font-size': 'var(--iris-font-size-sm, 13px)',
    'font-weight': '500',
    color: 'var(--iris-muted)',
    padding: pad(),
    ...(local.bordered ? { background: 'var(--iris-surface)' } : {}),
  })

  const valueStyle = (): JSX.CSSProperties => ({
    margin: '0',
    'font-size': 'var(--iris-font-size-md, 14px)',
    color: 'var(--iris-foreground)',
    padding: pad(),
  })

  return (
    <dl
      {...rest}
      data-iris-descriptions=""
      data-layout={local.layout}
      style={{
        display: 'grid',
        'grid-template-columns': horizontal()
          ? `repeat(${local.columns}, max-content 1fr)`
          : `repeat(${local.columns}, 1fr)`,
        gap: local.bordered ? '0' : horizontal() ? '8px 16px' : '12px',
        margin: '0',
        ...(local.bordered
          ? {
              border: '1px solid var(--iris-border)',
              'border-radius': 'var(--iris-radius-md, 6px)',
              overflow: 'hidden',
            }
          : {}),
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <For each={local.items}>
        {(item, index) => {
          const i = index()
          const rowBorder = (): string | undefined =>
            local.bordered && i >= local.columns ? '1px solid var(--iris-border)' : undefined

          if (horizontal()) {
            return (
              <>
                <dt
                  data-iris-descriptions-label=""
                  style={{
                    ...labelStyle(),
                    'border-block-start': rowBorder(),
                    'border-inline-end': local.bordered
                      ? '1px solid var(--iris-border)'
                      : undefined,
                  }}
                >
                  {String(item.label)}
                </dt>
                <dd
                  data-iris-descriptions-value=""
                  style={{ ...valueStyle(), 'border-block-start': rowBorder() }}
                >
                  {String(item.value)}
                </dd>
              </>
            )
          }

          return (
            <div
              data-iris-descriptions-item=""
              style={{
                'border-block-start': rowBorder(),
                'border-inline-start':
                  local.bordered && i % local.columns !== 0
                    ? '1px solid var(--iris-border)'
                    : undefined,
              }}
            >
              <dt data-iris-descriptions-label="" style={labelStyle()}>
                {String(item.label)}
              </dt>
              <dd data-iris-descriptions-value="" style={valueStyle()}>
                {String(item.value)}
              </dd>
            </div>
          )
        }}
      </For>
    </dl>
  )
}
