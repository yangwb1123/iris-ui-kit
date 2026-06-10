<script lang="ts">
  import IrisDialog from './IrisDialog.svelte'
  import IrisDialogTrigger from './IrisDialogTrigger.svelte'
  import IrisDialogContent from './IrisDialogContent.svelte'
  import IrisDialogTitle from './IrisDialogTitle.svelte'
  import IrisDialogDescription from './IrisDialogDescription.svelte'
  import IrisDialogClose from './IrisDialogClose.svelte'
</script>

<IrisDialog>
  <IrisDialogTrigger>Open Dialog</IrisDialogTrigger>
  <IrisDialogContent>
    <IrisDialogTitle>Dialog Title</IrisDialogTitle>
    <IrisDialogDescription>Dialog body content</IrisDialogDescription>
    <IrisDialogClose>Close</IrisDialogClose>
  </IrisDialogContent>
</IrisDialog>
