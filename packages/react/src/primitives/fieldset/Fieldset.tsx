import * as React from 'react'

export interface IrisFieldsetProps {
  legend?: React.ReactNode
  /** Disables the whole group (native fieldset disabling propagates to controls). */
  disabled?: boolean
  hint?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

/**
 * Fieldset: a semantic `<fieldset>` / `<legend>` form grouping. `disabled` uses
 * the native fieldset behavior that cascades to every nested form control —
 * accessible by construction.
 *
 * React port of {@link import('@iris-ui/vue').IrisFieldset}.
 */
export function IrisFieldset({
  legend,
  disabled = false,
  hint,
  children,
  style,
  className,
  ...rest
}: IrisFieldsetProps): React.ReactElement {
  return (
    <fieldset
      data-iris-fieldset=""
      disabled={disabled}
      className={className}
      {...rest}
      style={{
        minInlineSize: 0,
        margin: 0,
        padding: 16,
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {legend != null ? (
        <legend
          data-iris-fieldset-legend=""
          style={{
            padding: '0 6px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--iris-foreground)',
          }}
        >
          {legend}
        </legend>
      ) : null}
      {hint != null ? (
        <div
          data-iris-fieldset-hint=""
          style={{ fontSize: 12, color: 'var(--iris-muted)', marginBlockEnd: 8 }}
        >
          {hint}
        </div>
      ) : null}
      {children}
    </fieldset>
  )
}
