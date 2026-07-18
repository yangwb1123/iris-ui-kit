import { createSignal, mergeProps, onCleanup, splitProps, type JSX } from 'solid-js'
import { copyText } from '@iris-ui/core'
import { useI18n } from '../../i18n'

export type IrisCopyButtonSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<IrisCopyButtonSize, { padding: string; fontSize: string }> = {
  sm: { padding: '4px 8px', fontSize: '12px' },
  md: { padding: '6px 12px', fontSize: '14px' },
  lg: { padding: '8px 16px', fontSize: '16px' },
}

export interface IrisCopyButtonProps {
  text: string
  copiedLabel?: string
  timeout?: number
  disabled?: boolean
  size?: IrisCopyButtonSize
  onCopy?: (text: string) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Copy-to-clipboard button. Solid port of the Vue/React IrisCopyButton.
 */
export function IrisCopyButton(props: IrisCopyButtonProps): JSX.Element {
  const merged = mergeProps(
    { timeout: 2000, disabled: false, size: 'md' as IrisCopyButtonSize },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'text',
    'copiedLabel',
    'timeout',
    'disabled',
    'size',
    'onCopy',
    'children',
    'style',
    'class',
  ])

  const { t } = useI18n()

  const [copied, setCopied] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })

  const copy = async (): Promise<void> => {
    if (local.disabled) return
    try {
      // A host clipboard handler (setClipboardHandler) wins — needed where
      // navigator.clipboard is unavailable (Cordova file://, custom protocols).
      if (!(await copyText(local.text))) {
        // writeText returns a Promise; swallow async rejection (permission denied).
        void navigator.clipboard?.writeText?.(local.text)?.catch(() => {})
      }
    } catch {
      /* host handler / clipboard unavailable — still surface the copied state */
    }
    setCopied(true)
    local.onCopy?.(local.text)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => setCopied(false), local.timeout)
  }

  const sz = (): { padding: string; fontSize: string } => SIZE_MAP[local.size]

  return (
    <button
      {...rest}
      type="button"
      data-iris-copy-button=""
      data-copied={copied() ? 'true' : undefined}
      disabled={local.disabled}
      onClick={copy}
      class={local.class as string | undefined}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: '6px',
        padding: sz().padding,
        'font-size': sz().fontSize,
        'font-family': 'inherit',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        background: copied()
          ? 'var(--iris-success, #16a34a)'
          : 'var(--iris-surface, var(--iris-background))',
        color: copied() ? '#fff' : 'var(--iris-foreground)',
        cursor: local.disabled ? 'not-allowed' : 'pointer',
        opacity: local.disabled ? 0.6 : 1,
        transition: 'background-color 120ms ease, color 120ms ease',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {copied()
        ? (local.copiedLabel ?? t('copyButton.copied'))
        : (local.children ?? t('copyButton.copy'))}
    </button>
  )
}
