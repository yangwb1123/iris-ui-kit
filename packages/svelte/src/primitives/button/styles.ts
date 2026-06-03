import type { IrisButtonSize, IrisButtonVariant } from './types'

/**
 * Singleton stylesheet + inline-style builder for the Svelte `IrisButton`.
 * Byte-identical CSS + the same `var(--iris-*)` token model as the React/Vue/
 * Solid adapters (shared `<style id>` no-ops if more than one loads). Svelte's
 * `style` attribute takes a STRING, so `buildInlineStyle` returns a CSS string.
 */
const STYLE_ID = 'iris-button-styles'

const SIZE_STYLES: Record<IrisButtonSize, Record<string, string>> = {
  sm: { padding: 'var(--iris-padding-sm) var(--iris-padding-md)', 'font-size': '12px' },
  md: { padding: 'var(--iris-padding-sm) var(--iris-padding-lg)', 'font-size': '14px' },
  lg: { padding: 'var(--iris-padding-md) var(--iris-padding-lg)', 'font-size': '16px' },
}

const VARIANT_STYLES: Record<IrisButtonVariant, Record<string, string>> = {
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

export function styleToString(style: Record<string, string>): string {
  return Object.entries(style)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

export function buildInlineStyle(variant: IrisButtonVariant, size: IrisButtonSize): string {
  const merged: Record<string, string> = { ...SIZE_STYLES[size], ...VARIANT_STYLES[variant] }
  if (variant === 'link') merged.padding = '0'
  return styleToString(merged)
}

const CSS = `
.iris-button {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--iris-gap-sm, 4px);
  font-family: inherit;
  font-weight: 500;
  line-height: 1.2;
  border-radius: var(--iris-radius-md, 6px);
  white-space: nowrap;
  user-select: none;
  position: relative;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    filter 120ms ease;
}
.iris-button:focus-visible {
  outline: 2px solid var(--iris-primary);
  outline-offset: 2px;
}
.iris-button[disabled],
.iris-button[aria-busy="true"] {
  cursor: not-allowed;
  opacity: 0.6;
}
.iris-button[data-iris-button-variant="solid"]:not([disabled]):not([aria-busy="true"]):hover {
  filter: brightness(1.08);
}
.iris-button[data-iris-button-variant="outline"]:not([disabled]):not([aria-busy="true"]):hover,
.iris-button[data-iris-button-variant="ghost"]:not([disabled]):not([aria-busy="true"]):hover {
  background-color: var(--iris-surface-hover);
}
.iris-button[data-iris-button-variant="link"]:not([disabled]):not([aria-busy="true"]):hover {
  text-decoration: underline;
}
.iris-button-leading {
  display: inline-flex;
  align-items: center;
}
.iris-button-spinner {
  width: 1em;
  height: 1em;
  display: inline-block;
  animation: iris-button-spin 0.7s linear infinite;
}
@keyframes iris-button-spin {
  to { transform: rotate(360deg); }
}
`

let installed = false

export function installButtonStyles(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) {
    installed = true
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
  installed = true
}

/** Test-only reset. */
export function __resetButtonStyles(): void {
  installed = false
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
}

export const __BUTTON_STYLE_ID = STYLE_ID
