<script lang="ts">
  import IrisTabs from './IrisTabs.svelte'
  import IrisTabsList from './IrisTabsList.svelte'
  import IrisTabsTrigger from './IrisTabsTrigger.svelte'
  import IrisTabsContent from './IrisTabsContent.svelte'
  import IrisButton from '../button/IrisButton.svelte'
</script>

<IrisTabs defaultValue="one">
  <IrisTabsList>
    <IrisTabsTrigger value="one" asChild id="tab-one" class="trigger-rest">
      {#snippet children(props)}
        <IrisButton variant="outline" {...props.attrs.merge({})}>One</IrisButton>
      {/snippet}
    </IrisTabsTrigger>
    <IrisTabsTrigger value="two" asChild id="tab-two" class="trigger-rest">
      {#snippet children(props)}
        <IrisButton variant="outline" {...props.attrs.merge({})}>Two</IrisButton>
      {/snippet}
    </IrisTabsTrigger>
  </IrisTabsList>
  <IrisTabsContent value="one">First panel</IrisTabsContent>
  <IrisTabsContent value="two">Second panel</IrisTabsContent>
</IrisTabs>
