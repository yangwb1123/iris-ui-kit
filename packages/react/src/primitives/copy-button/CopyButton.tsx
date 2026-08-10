import * as React from 'react'
import { copyText } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'

export type IrisCopyButtonSize = 'sm' | 'md' | 'lg'

export interface IrisCopyButtonProps {
  /** Text to copy to the clipboard. */
  text: string
  /** Idle button content (default: localized "Copy"). */
  children?: React.ReactNode
  /** Content shown briefly after copying (default: localized "Copied"). */
  copiedLabel?: React.ReactNode
  /** How long the copied state lasts (ms). */
  timeout?: number
  onCopy?: (text: string) => void
  disabled?: boolean
  size?: IrisCopyButtonSize
  style?: React.CSSProperties
  className?: string
}

const SIZE_MAP: Record<IrisCopyButtonSize, { padding: string; fontSize: string }> = {
  sm: { padding: '4px 8px', fontSize: 'var(--iris-font-size-xs, 12px)' },
  md: {
    padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
  },
  lg: { padding: '8px 16px', fontSize: 'var(--iris-font-size-lg, 16px)' },
}

/**
 * Copy-to-clipboard button: writes `text` to the clipboard and flips to a
 * "Copied" state for `timeout` ms. The clipboard write is best-effort (guarded
 * for unsupported environments) and the copied state still reflects intent.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisCopyButton}.
 */
export function IrisCopyButton({
  text,
  children,
  copiedLabel,
  timeout = 2000,
  onCopy,
  disabled = false,
  size = 'md',
  style,
  className,
  ...rest
}: IrisCopyButtonProps): React.ReactElement {
  const { t } = useI18n()
  const [copied, setCopied] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const copy = async () => {
    if (disabled) return
    try {
      // A host clipboard handler (setClipboardHandler) wins — needed where
      // navigator.clipboard is unavailable (Cordova file://, custom protocols).
      if (!(await copyText(text))) {
        // writeText returns a Promise; swallow async rejection (permission denied).
        void navigator.clipboard?.writeText?.(text)?.catch(() => {})
      }
    } catch {
      /* host handler / clipboard unavailable — still surface the copied state */
    }
    setCopied(true)
    onCopy?.(text)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), timeout)
  }

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const sz = SIZE_MAP[size]

  return (
    <button
      type="button"
      data-iris-copy-button=""
      data-copied={copied ? 'true' : undefined}
      disabled={disabled}
      onClick={copy}
      className={className}
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--iris-space-xs, 8px)',
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontFamily: 'inherit',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        background: copied ? 'var(--iris-success, #10b981)' : 'var(--iris-surface)',
        color: copied ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background-color 120ms ease, color 120ms ease',
        ...style,
      }}
    >
      {copied ? (copiedLabel ?? t('copyButton.copied')) : (children ?? t('copyButton.copy'))}
    </button>
  )
}
