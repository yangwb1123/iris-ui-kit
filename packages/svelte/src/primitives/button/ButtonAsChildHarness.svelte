<script lang="ts">
  import IrisButton from './IrisButton.svelte'

  let {
    parentClick,
    childClick,
    disabled = false,
  }: {
    parentClick?: () => void
    childClick?: () => void
    disabled?: boolean
  } = $props()

  function handleChildClick(event: MouseEvent): void {
    event.preventDefault()
    childClick?.()
  }
</script>

<IrisButton
  asChild
  id="save-link"
  class="parent"
  style="color: red; background: black"
  onclick={parentClick}
  {disabled}
>
  {#snippet children(slotProps)}
    <a
      {...slotProps.merge({
        href: '/save',
        class: 'child',
        style: 'color: blue',
        onclick: handleChildClick,
      })}
    >
      Save link
    </a>
  {/snippet}
</IrisButton>
