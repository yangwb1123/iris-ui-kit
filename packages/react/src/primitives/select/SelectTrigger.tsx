import * as React from 'react'
import type { IrisSelectSize, IrisSelectTriggerState } from './Select'

export interface IrisSelectTriggerProps<T> {
  renderTrigger?: (state: IrisSelectTriggerState<T>) => React.ReactNode
  value: T | T[] | undefined
  label: string
  open: boolean
  id?: string
  ariaDescribedby?: string
  invalid: boolean
  disabled: boolean
  size: IrisSelectSize
  className?: string
  style: React.CSSProperties
  rest: React.ButtonHTMLAttributes<HTMLButtonElement>
}

export function renderIrisSelectTrigger<T>({
  renderTrigger,
  value,
  label,
  open,
  id,
  ariaDescribedby,
  invalid,
  disabled,
  size,
  className,
  style,
  rest,
}: IrisSelectTriggerProps<T>): React.ReactNode {
  if (renderTrigger) {
    return renderTrigger({
      value: value as T | undefined,
      label,
      open,
      id,
      ariaDescribedby,
      invalid,
      disabled,
    })
  }
  return (
    <button
      type="button"
      id={id}
      className={className}
      disabled={disabled || undefined}
      data-iris-select-trigger=""
      data-iris-select-size={size}
      data-state={open ? 'open' : 'closed'}
      aria-haspopup="listbox"
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={ariaDescribedby}
      {...rest}
      style={style}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--iris-muted)',
          pointerEvents: 'none',
        }}
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
