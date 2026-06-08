<script lang="ts">
  import IrisTabs from './IrisTabs.svelte'
  import IrisTabsList from './IrisTabsList.svelte'
  import IrisTabsTrigger from './IrisTabsTrigger.svelte'
  import IrisTabsContent from './IrisTabsContent.svelte'

  let { defaultValue = 'a' }: { defaultValue?: string } = $props()
</script>

<IrisTabs {defaultValue}>
  <IrisTabsList>
    <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
    <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
  </IrisTabsList>
  <IrisTabsContent value="a">Content A</IrisTabsContent>
  <IrisTabsContent value="b">Content B</IrisTabsContent>
</IrisTabs>
