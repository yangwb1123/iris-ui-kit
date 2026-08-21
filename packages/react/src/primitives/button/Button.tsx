import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react'
import { composeEventHandlers } from '@iris-ui-kit/core'
import type { IrisButtonSize, IrisButtonType, IrisButtonVariant } from './types'
import { installButtonStyles } from './styles'

type StyleMap = Record<string, string>

const SIZE_STYLES: Record<IrisButtonSize, StyleMap> = {
  sm: {
    padding: 'var(--iris-padding-sm) var(--iris-padding-md)',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    minHeight: 'var(--iris-control-height-sm, 28px)',
  },
  md: {
    padding: 'var(--iris-padding-sm) var(--iris-padding-lg)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: 'var(--iris-control-height-md, 34px)',
  },
  lg: {
    padding: 'var(--iris-padding-md) var(--iris-padding-lg)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: 'var(--iris-control-height-lg, 40px)',
  },
}

const VARIANT_STYLES: Record<IrisButtonVariant, StyleMap> = {
  solid: {
    background: 'var(--iris-primary)',
    color: 'var(--iris-primary-foreground)',
    border: '1px solid var(--iris-primary)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--iris-primary)',
    border: '1px solid var(--iris-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--iris-foreground)',
    border: '1px solid transparent',
  },
  link: {
    background: 'transparent',
    color: 'var(--iris-primary)',
    border: '1px solid transparent',
    textDecoration: 'none',
  },
  danger: {
    background: 'var(--iris-danger)',
    color: 'var(--iris-on-color, #ffffff)',
    border: '1px solid var(--iris-danger)',
  },
}

function buildInlineStyle(variant: IrisButtonVariant, size: IrisButtonSize): CSSProperties {
  const base: StyleMap = { ...SIZE_STYLES[size], ...VARIANT_STYLES[variant] }
  if (variant === 'link') {
    base.padding = '0'
    delete base.minHeight
  }
  return base as CSSProperties
}

function Spinner() {
  return (
    <svg className="iris-button-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export interface IrisButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'disabled' | 'onClick' | 'className' | 'style' | 'children'
> {
  variant?: IrisButtonVariant
  size?: IrisButtonSize
  disabled?: boolean
  loading?: boolean
  type?: IrisButtonType
  asChild?: boolean
  leading?: ReactNode
  children?: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLElement>
}

/**
 * Primary action button. Supports four variants (`solid`, `outline`, `ghost`,
 * `link`) and three sizes (`sm`, `md`, `lg`). Each variant is styled via
 * CSS custom properties (`var(--iris-primary)`, `var(--iris-border)` etc.)
 * so the button automatically adapts to the active theme/skin.
 *
 * When `loading` is true a spinner replaces the leading icon and clicks are
 * suppressed. Pass `asChild` to delegate rendering to a single child element
 * (e.g. `<IrisButton asChild><a href="…">link</a></IrisButton>`).
 *
 * All unlisted HTML attributes (`aria-*`, `data-*`, `id`, etc.) are forwarded
 * to the root `<button>` element via `{...rest}`.
 *
 * @example
 *   <IrisButton variant="solid" onClick={() => save()}>Save</IrisButton>
 *
 * @example
 *   <IrisButton variant="outline" size="sm" loading>Processing</IrisButton>
 *
 * @example
 *   <IrisButton asChild><a href="/dashboard">Dashboard</a></IrisButton>
 */
export function IrisButton({
  variant = 'solid',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  asChild = false,
  leading,
  children,
  className,
  style,
  onClick,
  ...rest
}: IrisButtonProps) {
  useEffect(() => {
    installButtonStyles()
  }, [])

  const isInteractive = !disabled && !loading

  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isInteractive) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onClick?.(event)
  }

  const baseProps = {
    className: ['iris-button', className].filter(Boolean).join(' '),
    'data-iris-button-variant': variant,
    'data-iris-button-size': size,
    'aria-disabled': disabled ? ('true' as const) : undefined,
    'aria-busy': loading ? ('true' as const) : undefined,
    style: { ...buildInlineStyle(variant, size), ...(style ?? {}) },
  }

  if (asChild) {
    const only = Children.only(children) as ReactElement | undefined
    if (!only || !isValidElement(only)) {
      if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
        console.warn('[iris-ui] IrisButton: as-child requires a single React element child')
      }
      return null
    }
    const childProps = only.props as {
      className?: string
      style?: CSSProperties
      onClick?: MouseEventHandler<HTMLElement>
    }
    return cloneElement(only, {
      ...rest,
      ...baseProps,
      className: [baseProps.className, childProps.className].filter(Boolean).join(' '),
      style: { ...baseProps.style, ...(childProps.style ?? {}) },
      onClick: composeEventHandlers(
        handleClick as (e: ReactMouseEvent<HTMLElement>) => void,
        (childProps.onClick ?? (() => {})) as (e: ReactMouseEvent<HTMLElement>) => void,
      ),
      ...(isInteractive ? {} : { disabled: true }),
    } as Record<string, unknown>)
  }

  return (
    <button {...rest} type={type} disabled={!isInteractive} onClick={handleClick} {...baseProps}>
      {(loading || leading) && (
        <span className="iris-button-leading">{loading ? <Spinner /> : leading}</span>
      )}
      {children}
    </button>
  )
}
