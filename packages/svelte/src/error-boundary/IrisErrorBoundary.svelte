<script lang="ts">
  // IrisErrorBoundary — catches render/effect errors thrown by the guarded
  // subtree and swaps to a fallback. Mirrors @iris-ui-kit/{react,vue,solid}.
  // Built on Svelte 5's <svelte:boundary>. Catching does NOT rethrow.
  import type { Snippet } from 'svelte'
  import { useI18n } from '../i18n'

  let {
    children,
    fallback,
    onError,
    ...rest
  }: {
    children?: Snippet<[]>
    fallback?: Snippet<[{ error: unknown; reset: () => void }]>
    onError?: (error: unknown) => void
    [key: string]: unknown
  } = $props()

  const { t } = useI18n()

  function messageOf(error: unknown): string {
    const m = error instanceof Error ? error.message : ''
    return m && m.length > 0 ? m : t('errorBoundary.message')
  }
</script>

<svelte:boundary onerror={(error) => onError?.(error)}>
  {@render children?.()}

  {#snippet failed(error, reset)}
    {#if fallback}
      {@render fallback({ error, reset })}
    {:else}
      <div
        {...rest}
        data-iris-error-boundary
        role="alert"
        style="padding: 16px; border: 1px solid var(--iris-danger); border-radius: var(--iris-radius-md, 6px); color: var(--iris-danger)"
      >
        <div data-iris-error-boundary-message>
          {messageOf(error)}
        </div>
        <button type="button" data-iris-error-boundary-retry onclick={reset}>
          {t('errorBoundary.retry')}
        </button>
      </div>
    {/if}
  {/snippet}
</svelte:boundary>
