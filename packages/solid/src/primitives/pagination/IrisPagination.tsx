import { createMemo, createSignal, For, mergeProps, splitProps, type JSX } from 'solid-js'
import { getPageRange, type PageItem } from '@iris-ui/core'

export type IrisPaginationSize = 'sm' | 'md'

/** The page-range algorithm now lives in @iris-ui/core; this preserves the name. */
export type IrisPageItem = PageItem

export interface IrisPaginationProps {
  page?: number
  defaultPage?: number
  total: number
  pageSize?: number
  siblingCount?: number
  showFirstLast?: boolean
  size?: IrisPaginationSize
  disabled?: boolean
  onChange?: (page: number) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Pagination control. Solid port of the Vue/React IrisPagination.
 */
export function IrisPagination(props: IrisPaginationProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultPage: 1,
      pageSize: 10,
      siblingCount: 1,
      showFirstLast: false,
      size: 'md' as IrisPaginationSize,
      disabled: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'page',
    'defaultPage',
    'total',
    'pageSize',
    'siblingCount',
    'showFirstLast',
    'size',
    'disabled',
    'onChange',
  ])

  const isControlled = (): boolean => local.page !== undefined
  const [internal, setInternal] = createSignal(local.defaultPage ?? 1)

  const totalPages = createMemo(() =>
    Math.max(1, Math.ceil(local.total / Math.max(1, local.pageSize))),
  )

  const current = createMemo(() =>
    Math.min(totalPages(), Math.max(1, isControlled() ? (local.page as number) : internal())),
  )

  const items = createMemo<IrisPageItem[]>(() =>
    getPageRange(current(), totalPages(), local.siblingCount),
  )

  const go = (page: number): void => {
    if (local.disabled) return
    const next = Math.min(totalPages(), Math.max(1, page))
    if (next === current()) return
    if (!isControlled()) setInternal(next)
    local.onChange?.(next)
  }

  const btnSize = (): string => (local.size === 'sm' ? '28px' : '32px')
  const fontSize = (): string => (local.size === 'sm' ? '12px' : '14px')

  const baseBtnStyle = (): JSX.CSSProperties => ({
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    'min-width': btnSize(),
    height: btnSize(),
    padding: '0 8px',
    background: 'transparent',
    color: 'var(--iris-foreground)',
    border: '1px solid var(--iris-border)',
    'border-radius': 'var(--iris-radius-md, 6px)',
    cursor: 'pointer',
    'font-size': fontSize(),
    'font-family': 'inherit',
    'line-height': '1',
  })

  const renderBtn = (
    page: number | null,
    label: string,
    opts: { kind: string; disabled?: boolean; active?: boolean },
  ): JSX.Element => {
    const isDisabled = opts.disabled || local.disabled
    const isActive = opts.active === true
    return (
      <button
        type="button"
        data-iris-pagination-item={opts.kind}
        data-iris-pagination-active={isActive ? 'true' : undefined}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        disabled={isDisabled}
        onClick={() => {
          if (page !== null) go(page)
        }}
        style={{
          ...baseBtnStyle(),
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          ...(isActive
            ? {
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground, #fff)',
                'border-color': 'var(--iris-primary)',
              }
            : {}),
        }}
      >
        {opts.kind === 'page' ? String(page) : label}
      </button>
    )
  }

  return (
    <nav
      {...rest}
      aria-label="Pagination"
      data-iris-pagination=""
      data-iris-pagination-size={local.size}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: '4px',
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.showFirstLast && renderBtn(1, 'First', { kind: 'first', disabled: current() <= 1 })}
      {renderBtn(current() - 1, 'Previous', { kind: 'prev', disabled: current() <= 1 })}
      <For each={items()}>
        {(item) => {
          if (item === 'ellipsis-left' || item === 'ellipsis-right') {
            return (
              <span
                data-iris-pagination-ellipsis={item === 'ellipsis-left' ? 'left' : 'right'}
                style={{
                  display: 'inline-flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  'min-width': btnSize(),
                  height: btnSize(),
                  color: 'var(--iris-muted)',
                  'font-size': fontSize(),
                }}
              >
                …
              </span>
            )
          }
          return renderBtn(item, `Page ${item}`, { kind: 'page', active: item === current() })
        }}
      </For>
      {renderBtn(current() + 1, 'Next', { kind: 'next', disabled: current() >= totalPages() })}
      {local.showFirstLast &&
        renderBtn(totalPages(), 'Last', { kind: 'last', disabled: current() >= totalPages() })}
    </nav>
  )
}
