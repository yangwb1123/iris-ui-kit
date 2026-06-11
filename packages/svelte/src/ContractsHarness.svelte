<script lang="ts">
  // Cross-framework contract harness: composes IrisTabs (3 triggers/panels,
  // first active) + an uncontrolled IrisSwitch (off by default) so the shared
  // tabs/switch scenarios run against the real Svelte bridges. Mount with
  // @testing-library/svelte; the result `container` is the ContractDriver root.
  import IrisTabs from './primitives/tabs/IrisTabs.svelte'
  import IrisTabsList from './primitives/tabs/IrisTabsList.svelte'
  import IrisTabsTrigger from './primitives/tabs/IrisTabsTrigger.svelte'
  import IrisTabsContent from './primitives/tabs/IrisTabsContent.svelte'
  import IrisSwitch from './primitives/switch/Switch.svelte'
</script>

<IrisTabs defaultValue="a">
  <IrisTabsList>
    <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
    <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
    <IrisTabsTrigger value="c">Tab C</IrisTabsTrigger>
  </IrisTabsList>
  <IrisTabsContent value="a">Panel A</IrisTabsContent>
  <IrisTabsContent value="b">Panel B</IrisTabsContent>
  <IrisTabsContent value="c">Panel C</IrisTabsContent>
</IrisTabs>

<IrisSwitch />
