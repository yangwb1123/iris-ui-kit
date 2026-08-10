import { mergeProps, splitProps, Show, type JSX } from 'solid-js'
import { onMount } from 'solid-js'
import type { IrisButtonSize, IrisButtonType, IrisButtonVariant } from './types'
import { installButtonStyles } from './styles'
import { IrisSlot } from '../slot/IrisSlot'

type StyleMap = Record<string, string>

const SIZE_STYLES: Record<IrisButtonSize, StyleMap> = {
  sm: {
    padding: 'var(--iris-padding-sm) var(--iris-padding-md)',
    'font-size': 'var(--iris-font-size-xs, 12px)',
  },
  md: {
    padding: 'var(--iris-padding-sm) var(--iris-padding-lg)',
    'font-size': 'var(--iris-font-size-md, 14px)',
  },
  lg: {
    padding: 'var(--iris-padding-md) var(--iris-padding-lg)',
    'font-size': 'var(--iris-font-size-lg, 16px)',
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

function buildInlineStyle(variant: IrisButtonVariant, size: IrisButtonSize): JSX.CSSProperties {
  const base: StyleMap = { ...SIZE_STYLES[size], ...VARIANT_STYLES[variant] }
  if (variant === 'link') base.padding = '0'
  return base as JSX.CSSProperties
}

function Spinner(): JSX.Element {
  return (
    <svg class="iris-button-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      />
    </svg>
  )
}

export interface IrisButtonProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'disabled' | 'onClick' | 'class' | 'style' | 'children'
> {
  variant?: IrisButtonVariant
  size?: IrisButtonSize
  disabled?: boolean
  loading?: boolean
  type?: IrisButtonType
  asChild?: boolean
  /** Leading content (icon / spinner replaces it when loading). */
  leading?: JSX.Element
  class?: string
  style?: JSX.CSSProperties
  children?: JSX.Element
  onClick?: (event: MouseEvent) => void
}

/**
 * Solid port of `IrisButton`. Same prop contract + DOM as the React/Vue
 * versions (variant/size/disabled/loading/type/leading) — no business logic
 * duplicated; only the thin Solid wrapper differs.
 *
 * `asChild` merges these props onto the single supplied element through
 * `IrisSlot`, returning that element directly with no wrapper.
 */
export function IrisButton(props: IrisButtonProps): JSX.Element {
  const merged = mergeProps(
    {
      variant: 'solid' as IrisButtonVariant,
      size: 'md' as IrisButtonSize,
      disabled: false,
      loading: false,
      type: 'button' as IrisButtonType,
    },
    props,
  )
  const [local, others] = splitProps(merged, [
    'variant',
    'size',
    'disabled',
    'loading',
    'type',
    'asChild',
    'leading',
    'class',
    'style',
    'children',
    'onClick',
    'ref',
  ])

  onMount(() => installButtonStyles())

  const interactive = (): boolean => !local.disabled && !local.loading
  const handleClick = (event: MouseEvent): void => {
    if (!interactive()) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    local.onClick?.(event)
  }

  const visualProps = {
    get class() {
      return ['iris-button', local.class].filter(Boolean).join(' ')
    },
    get 'data-iris-button-variant'() {
      return local.variant
    },
    get 'data-iris-button-size'() {
      return local.size
    },
    get 'aria-disabled'() {
      return local.disabled ? 'true' : undefined
    },
    get 'aria-busy'() {
      return local.loading ? 'true' : undefined
    },
    get style() {
      return { ...buildInlineStyle(local.variant, local.size), ...(local.style ?? {}) }
    },
    onClick: handleClick,
  }

  if (local.asChild) {
    return (
      <IrisSlot
        {...others}
        {...visualProps}
        attr:disabled={interactive() ? undefined : true}
        ref={(element) => {
          if (typeof local.ref === 'function') local.ref(element as HTMLButtonElement)
        }}
      >
        {local.children}
      </IrisSlot>
    )
  }

  return (
    <button
      type={local.type}
      {...others}
      {...visualProps}
      disabled={!interactive()}
      ref={local.ref}
    >
      <Show when={local.loading || local.leading}>
        <span class="iris-button-leading">{local.loading ? <Spinner /> : local.leading}</span>
      </Show>
      {local.children}
    </button>
  )
}
