<script lang="ts">
  // Test fixture: IrisDialogContent with the declarative sizing props, opened
  // on mount so a test can assert the surface geometry.
  import IrisDialog from './IrisDialog.svelte'
  import IrisDialogTrigger from './IrisDialogTrigger.svelte'
  import IrisDialogContent from './IrisDialogContent.svelte'
  import IrisDialogTitle from './IrisDialogTitle.svelte'
  import IrisDialogDescription from './IrisDialogDescription.svelte'
  import IrisDialogClose from './IrisDialogClose.svelte'
  import type { DialogSize, LayoutLength } from '@iris-ui-kit/core'

  let {
    size = undefined,
    width = undefined,
    maxHeight = undefined,
  }: {
    size?: DialogSize
    width?: LayoutLength
    maxHeight?: LayoutLength
  } = $props()
</script>

<IrisDialog defaultOpen>
  <IrisDialogTrigger>Open Dialog</IrisDialogTrigger>
  <IrisDialogContent {size} {width} {maxHeight}>
    <IrisDialogTitle>Dialog Title</IrisDialogTitle>
    <IrisDialogDescription>Dialog body content</IrisDialogDescription>
    <input data-testid="first" />
    <button type="button" data-testid="last">Action</button>
    <IrisDialogClose>Close</IrisDialogClose>
  </IrisDialogContent>
</IrisDialog>
