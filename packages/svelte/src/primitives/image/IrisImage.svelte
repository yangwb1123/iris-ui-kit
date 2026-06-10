<script lang="ts">
  import { mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  let {
    src,
    alt = '',
    width = undefined as number | string | undefined,
    height = undefined as number | string | undefined,
    fallback = undefined as string | undefined,
    preview = true,
    style,
    ...rest
  } = $props()

  // svelte-ignore state_referenced_locally
  let errored = $state(false)
  // svelte-ignore state_referenced_locally
  let open = $state(false)

  const shownSrc = $derived(errored && fallback ? fallback : src)
  const canPreview = $derived(preview && !errored)

  function handleError() {
    if (!errored) errored = true
  }

  function handleClick() {
    if (canPreview) open = true
  }

  function handleClose() {
    open = false
  }

  $effect(() => {
    errored = false
  })

  $effect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') open = false
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })
</script>

<img
  {...rest}
  data-iris-image
  data-errored={errored ? 'true' : undefined}
  {src}
  {alt}
  {width}
  {height}
  loading="lazy"
  onerror={handleError}
  onclick={handleClick}
  style={mergeStyle(
    `display: inline-block; object-fit: cover${canPreview ? '; cursor: zoom-in' : ''}`,
    style,
  )}
/>

{#if open}
  <div
    data-iris-image-preview
    role="dialog"
    aria-modal="true"
    aria-label={alt || t('image.preview')}
    tabindex="-1"
    onclick={handleClose}
    onkeydown={(e) => { if (e.key === 'Escape') handleClose() }}
    style="position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); cursor: zoom-out"
  >
    <img
      data-iris-image-preview-img
      src={shownSrc}
      {alt}
      style="max-width: 90vw; max-height: 90vh; object-fit: contain"
    />
    <button
      type="button"
      data-iris-image-preview-close
      aria-label={t('dialog.close')}
      onclick={(e) => { e.stopPropagation(); handleClose() }}
      style="position: absolute; inset-block-start: 16px; inset-inline-end: 16px; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: #fff; font-size: 22px; line-height: 1; cursor: pointer"
    >
      ×
    </button>
  </div>
{/if}
