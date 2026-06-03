import { mergeProps, splitProps, Show, type JSX } from 'solid-js'
import { onMount } from 'solid-js'
import type { IrisButtonSize, IrisButtonType, IrisButtonVariant } from './types'
import { installButtonStyles } from './styles'

type StyleMap = Record<string, string>

const SIZE_STYLES: Record<IrisButtonSize, StyleMap> = {
  sm: { padding: 'var(--iris-padding-sm) var(--iris-padding-md)', 'font-size': '12px' },
  md: { padding: 'var(--iris-padding-sm) var(--iris-padding-lg)', 'font-size': '14px' },
  lg: { padding: 'var(--iris-padding-md) var(--iris-padding-lg)', 'font-size': '16px' },
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
    'text-decoration': 'none',
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

export interface IrisButtonProps {
  variant?: IrisButtonVariant
  size?: IrisButtonSize
  disabled?: boolean
  loading?: boolean
  type?: IrisButtonType
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
 * (The React/Vue `asChild` polymorphism relies on cloneElement, which Solid
 * lacks; Solid's idiom is a `Dynamic`/`as` prop — deferred as a follow-up.)
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
    'leading',
    'class',
    'style',
    'children',
    'onClick',
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

  return (
    <button
      type={local.type}
      class={['iris-button', local.class].filter(Boolean).join(' ')}
      data-iris-button-variant={local.variant}
      data-iris-button-size={local.size}
      aria-disabled={local.disabled ? 'true' : undefined}
      aria-busy={local.loading ? 'true' : undefined}
      disabled={!interactive()}
      style={{ ...buildInlineStyle(local.variant, local.size), ...(local.style ?? {}) }}
      onClick={handleClick}
      {...others}
    >
      <Show when={local.loading || local.leading}>
        <span class="iris-button-leading">{local.loading ? <Spinner /> : local.leading}</span>
      </Show>
      {local.children}
    </button>
  )
}
