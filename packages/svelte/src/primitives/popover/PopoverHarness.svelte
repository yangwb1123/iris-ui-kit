<script lang="ts">
  import IrisPopover from './IrisPopover.svelte'
  import IrisPopoverTrigger from './IrisPopoverTrigger.svelte'
  import IrisPopoverContent from './IrisPopoverContent.svelte'
</script>

<IrisPopover>
  <IrisPopoverTrigger>Open Popover</IrisPopoverTrigger>
  <IrisPopoverContent>
    <p>Popover body content</p>
  </IrisPopoverContent>
</IrisPopover>
