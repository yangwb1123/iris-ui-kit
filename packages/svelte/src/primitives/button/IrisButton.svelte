<script lang="ts">
  import type { Snippet } from 'svelte'
  import { installButtonStyles, buildInlineStyle } from './styles'
  import type { IrisButtonSize, IrisButtonType, IrisButtonVariant } from './types'

  interface Props {
    variant?: IrisButtonVariant
    size?: IrisButtonSize
    disabled?: boolean
    loading?: boolean
    type?: IrisButtonType
    onclick?: (e: MouseEvent) => void
    /** Leading content (icon); replaced by the spinner when loading. */
    leading?: Snippet
    children?: Snippet
  }

  let {
    variant = 'solid',
    size = 'md',
    disabled = false,
    loading = false,
    type = 'button',
    onclick,
    leading,
    children,
  }: Props = $props()

  $effect(() => installButtonStyles())

  const interactive = $derived(!disabled && !loading)
  const style = $derived(buildInlineStyle(variant, size))

  function handleClick(e: MouseEvent) {
    if (!interactive) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onclick?.(e)
  }
</script>

<button
  class="iris-button"
  {type}
  {style}
  disabled={interactive ? undefined : true}
  aria-disabled={disabled ? 'true' : undefined}
  aria-busy={loading ? 'true' : undefined}
  data-iris-button-variant={variant}
  data-iris-button-size={size}
  onclick={handleClick}
>
  {#if loading}
    <span class="iris-button-leading">
      <svg class="iris-button-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-opacity="0.25"
          stroke-width="3"
        />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
        />
      </svg>
    </span>
  {:else if leading}
    <span class="iris-button-leading">{@render leading()}</span>
  {/if}
  {@render children?.()}
</button>
