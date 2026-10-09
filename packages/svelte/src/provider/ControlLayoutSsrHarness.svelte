<script lang="ts">
  import { createTabsNav, type Size } from '@iris-ui-kit/core'
  import IrisProvider from './IrisProvider.svelte'
  import IrisInput from '../primitives/input/Input.svelte'
  import IrisFormField from '../primitives/form-field/FormField.svelte'
  import IrisDialog from '../primitives/dialog/IrisDialog.svelte'
  import IrisDialogContent from '../primitives/dialog/IrisDialogContent.svelte'
  import IrisDialogTitle from '../primitives/dialog/IrisDialogTitle.svelte'
  import IrisAdminLayout from '../admin/AdminLayout.svelte'

  let { componentSize = 'md' }: { componentSize?: Size } = $props()
  const tabs = createTabsNav()
</script>

<IrisProvider {componentSize}>
  <IrisFormField label="Quantity" labelPlacement="start" controlWidth="12rem" hint="Units">
    <IrisInput fullWidth />
  </IrisFormField>
  <IrisInput size="md" aria-label="Explicit" />
  <IrisAdminLayout menus={[{ key: 'a', title: 'A' }]} {tabs} />
  <IrisDialog defaultOpen>
    <IrisDialogContent size="xl">
      <IrisDialogTitle>Title</IrisDialogTitle>
    </IrisDialogContent>
  </IrisDialog>
</IrisProvider>
