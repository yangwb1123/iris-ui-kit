<script lang="ts">
  import IrisDialog from './IrisDialog.svelte'
  import IrisDialogTrigger from './IrisDialogTrigger.svelte'
  import IrisDialogContent from './IrisDialogContent.svelte'
  import IrisDialogTitle from './IrisDialogTitle.svelte'
  import IrisDialogDescription from './IrisDialogDescription.svelte'
  import IrisDialogClose from './IrisDialogClose.svelte'
  import IrisButton from '../button/IrisButton.svelte'
</script>

<IrisDialog>
  <IrisDialogTrigger asChild id="dialog-trigger" class="trigger-rest" data-trigger-rest="kept">
    {#snippet children(props)}
      <IrisButton variant="outline" {...props.attrs}>Open Dialog</IrisButton>
    {/snippet}
  </IrisDialogTrigger>
  <IrisDialogContent>
    <IrisDialogTitle>Dialog Title</IrisDialogTitle>
    <IrisDialogDescription>Dialog body content</IrisDialogDescription>
    <IrisDialogClose asChild id="dialog-close" data-close-rest="kept">
      {#snippet children(props)}
        <IrisButton variant="solid" {...props}>Close</IrisButton>
      {/snippet}
    </IrisDialogClose>
  </IrisDialogContent>
</IrisDialog>
