import * as React from 'react'
import { IrisInput, type IrisInputProps } from '../input/Input'

export interface IrisPasswordInputProps
  extends Omit<IrisInputProps, 'type' | 'prefix' | 'suffix' | 'children'> {
  /** Allow toggling visibility. Default true. */
  showToggle?: boolean
  /** Custom suffix slot (rendered before the toggle). */
  suffix?: React.ReactNode
  /** Custom prefix slot. */
  prefix?: React.ReactNode
}

/** React port of {@link import('@iris-ui/vue').IrisPasswordInput}. */
export const IrisPasswordInput = React.forwardRef<HTMLInputElement, IrisPasswordInputProps>(
  function IrisPasswordInput(
    { showToggle = true, suffix, prefix, disabled, readOnly, ...rest },
    ref,
  ) {
    const [visible, setVisible] = React.useState(false)
    const toggle = () => {
      if (disabled || readOnly) return
      setVisible((v) => !v)
    }

    const toggleBtn = showToggle ? (
      <button
        type="button"
        data-iris-password-input-toggle=""
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible ? 'true' : 'false'}
        onClick={toggle}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--iris-muted)',
          padding: '0 2px',
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        {visible ? '🙈' : '👁'}
      </button>
    ) : null

    return (
      <IrisInput
        {...rest}
        ref={ref}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        readOnly={readOnly}
        prefix={prefix}
        suffix={
          <>
            {suffix}
            {toggleBtn}
          </>
        }
        data-iris-password-input=""
      />
    )
  },
)
