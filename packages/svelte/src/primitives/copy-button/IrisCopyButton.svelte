<script lang="ts">
  import { copyText } from '@iris-ui/core'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type CopyButtonSize = 'sm' | 'md' | 'lg'

  const SIZE_MAP: Record<CopyButtonSize, { padding: string; fontSize: string }> = {
    sm: { padding: '4px 8px', fontSize: '12px' },
    md: { padding: '6px 12px', fontSize: '14px' },
    lg: { padding: '8px 16px', fontSize: '16px' },
  }

  let {
    text,
    copiedLabel,
    timeout = 2000,
    disabled = false,
    size = 'md',
    oncopy,
    children,
    style,
    ...rest
  }: {
    text: string
    copiedLabel?: string
    timeout?: number
    disabled?: boolean
    size?: CopyButtonSize
    oncopy?: (text: string) => void
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  } = $props()

  let copied = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const sz = $derived(SIZE_MAP[size])

  async function copy(): Promise<void> {
    if (disabled) return
    try {
      // A host clipboard handler (setClipboardHandler) wins — needed where
      // navigator.clipboard is unavailable (Cordova file://, custom protocols).
      if (!(await copyText(text))) {
        // writeText returns a Promise; swallow async rejection (permission denied).
        void navigator.clipboard?.writeText?.(text)?.catch(() => {})
      }
    } catch {
      // host handler / clipboard unavailable — still surface the copied state
    }
    copied = true
    oncopy?.(text)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      copied = false
    }, timeout)
  }

  $effect(() => {
    return () => {
      if (timer) clearTimeout(timer)
    }
  })
</script>

<button
  {...rest}
  type="button"
  data-iris-copy-button
  data-copied={copied ? 'true' : undefined}
  {disabled}
  onclick={copy}
  style="display:inline-flex; align-items:center; gap:6px; padding:{sz.padding}; font-size:{sz.fontSize}; font-family:inherit; border:1px solid var(--iris-border); border-radius:var(--iris-radius-md,6px); background:{copied
    ? 'var(--iris-success,#16a34a)'
    : 'var(--iris-surface)'}; color:{copied ? '#fff' : 'var(--iris-foreground)'}; cursor:{disabled
    ? 'not-allowed'
    : 'pointer'}; opacity:{disabled
    ? '0.6'
    : '1'}; transition:background-color 120ms ease,color 120ms ease;{style ? ' ' + style : ''}"
>
  {#if copied}
    {copiedLabel ?? t('copyButton.copied')}
  {:else if children}
    {@render children()}
  {:else}
    {t('copyButton.copy')}
  {/if}
</button>
