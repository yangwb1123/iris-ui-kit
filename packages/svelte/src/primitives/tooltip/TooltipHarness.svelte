<script lang="ts">
  import IrisTooltip from './IrisTooltip.svelte'

  let {
    content = 'Tooltip',
    openDelay = 0,
  }: {
    content?: string
    openDelay?: number
  } = $props()
</script>

<IrisTooltip {content} {openDelay} portalTarget={false}>
  <button type="button" data-testid="tooltip-child">Trigger</button>
</IrisTooltip>
