import * as React from 'react'
import { getPageRange } from './types'

export type IrisPaginationSize = 'sm' | 'md'

export interface IrisPaginationProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  /** Current page (1-indexed). Controlled. */
  value?: number
  /** Initial page in uncontrolled mode. */
  defaultValue?: number
  onValueChange?: (next: number) => void
  /** Total number of items across all pages. */
  total: number
  pageSize?: number
  siblingCount?: number
  showFirstLast?: boolean
  size?: IrisPaginationSize
  disabled?: boolean
}

/**
 * Numeric page selector with prev/next + optional first/last buttons and
 * two-sided ellipsis. Stateless visual; the caller owns `value`.
 */
export function IrisPagination({
  value: valueProp,
  defaultValue = 1,
  onValueChange,
  total,
  pageSize = 10,
  siblingCount = 1,
  showFirstLast = false,
  size = 'md',
  disabled = false,
  style,
  ...rest
}: IrisPaginationProps): React.ReactElement {
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const raw = isControlled ? (valueProp as number) : internal
  const current = Math.min(totalPages, Math.max(1, raw))
  const items = getPageRange(current, totalPages, siblingCount)

  const go = (page: number) => {
    if (disabled) return
    const next = Math.min(totalPages, Math.max(1, page))
    if (next === current) return
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const btnSize = size === 'sm' ? 28 : 32
  const fontSize = size === 'sm' ? 12 : 14

  const baseBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: btnSize,
    height: btnSize,
    padding: '0 8px',
    background: 'transparent',
    color: 'var(--iris-foreground)',
    border: '1px solid var(--iris-border)',
    borderRadius: 'var(--iris-radius-md, 6px)',
    cursor: 'pointer',
    fontSize,
    fontFamily: 'inherit',
    lineHeight: 1,
  }

  const renderBtn = (
    page: number | null,
    label: string,
    opts: { kind: string; disabled?: boolean; active?: boolean; key?: React.Key },
  ): React.ReactElement => {
    const isDisabled = opts.disabled || disabled
    const isActive = opts.active === true
    return (
      <button
        key={opts.key}
        type="button"
        data-iris-pagination-item={opts.kind}
        data-iris-pagination-active={isActive ? 'true' : undefined}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        disabled={isDisabled || undefined}
        onClick={() => {
          if (page !== null) go(page)
        }}
        style={{
          ...baseBtnStyle,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          ...(isActive
            ? {
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground, #fff)',
                borderColor: 'var(--iris-primary)',
              }
            : {}),
        }}
      >
        {opts.kind === 'page' ? String(page) : label}
      </button>
    )
  }

  const renderEllipsis = (side: 'left' | 'right') => (
    <span
      key={`ellipsis-${side}`}
      data-iris-pagination-ellipsis={side}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: btnSize,
        height: btnSize,
        color: 'var(--iris-muted)',
        fontSize,
      }}
    >
      …
    </span>
  )

  return (
    <nav
      {...rest}
      aria-label="Pagination"
      data-iris-pagination=""
      data-iris-pagination-size={size}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      {showFirstLast
        ? renderBtn(1, 'First page', {
            kind: 'first',
            disabled: current <= 1,
            key: 'first',
          })
        : null}
      {renderBtn(current - 1, 'Previous page', {
        kind: 'prev',
        disabled: current <= 1,
        key: 'prev',
      })}
      {items.map((item) => {
        if (item === 'ellipsis-left') return renderEllipsis('left')
        if (item === 'ellipsis-right') return renderEllipsis('right')
        return renderBtn(item, `Page ${item}`, {
          kind: 'page',
          active: item === current,
          key: `page-${item}`,
        })
      })}
      {renderBtn(current + 1, 'Next page', {
        kind: 'next',
        disabled: current >= totalPages,
        key: 'next',
      })}
      {showFirstLast
        ? renderBtn(totalPages, 'Last page', {
            kind: 'last',
            disabled: current >= totalPages,
            key: 'last',
          })
        : null}
    </nav>
  )
}
