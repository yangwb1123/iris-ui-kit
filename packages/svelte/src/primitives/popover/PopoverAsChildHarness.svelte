<script lang="ts">
  import IrisPopover from './IrisPopover.svelte'
  import IrisPopoverTrigger from './IrisPopoverTrigger.svelte'
  import IrisPopoverContent from './IrisPopoverContent.svelte'
  import IrisButton from '../button/IrisButton.svelte'
</script>

<IrisPopover>
  <IrisPopoverTrigger asChild id="popover-trigger" class="trigger-rest" data-trigger-rest="kept">
    {#snippet children(props)}
      <IrisButton variant="outline" {...props.attrs.merge({})}>Open Popover</IrisButton>
    {/snippet}
  </IrisPopoverTrigger>
  <IrisPopoverContent>Popover body content</IrisPopoverContent>
</IrisPopover>
