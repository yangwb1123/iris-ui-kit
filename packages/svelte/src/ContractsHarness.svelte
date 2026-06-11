<script lang="ts">
  // Cross-framework contract harness: composes IrisTabs (3 triggers/panels,
  // first active) + an uncontrolled IrisSwitch (off by default) + an
  // uncontrolled IrisCheckbox + an IrisAccordion (2 items, both collapsed) so
  // the shared tabs/switch/checkbox/accordion scenarios run against the real
  // Svelte bridges. Mount with @testing-library/svelte; the result `container`
  // is the ContractDriver root.
  //
  // NOTE: IrisCheckbox is value-prop-driven (no internal state), so — exactly
  // like the v-model Switch wrap in R68 — we hold local state here and toggle it
  // from `onchange` to emulate the uncontrolled checkbox the contract expects.
  import IrisTabs from './primitives/tabs/IrisTabs.svelte'
  import IrisTabsList from './primitives/tabs/IrisTabsList.svelte'
  import IrisTabsTrigger from './primitives/tabs/IrisTabsTrigger.svelte'
  import IrisTabsContent from './primitives/tabs/IrisTabsContent.svelte'
  import IrisSwitch from './primitives/switch/Switch.svelte'
  import IrisCheckbox from './primitives/checkbox/IrisCheckbox.svelte'
  import IrisAccordion from './primitives/accordion/IrisAccordion.svelte'
  import IrisAccordionItem from './primitives/accordion/IrisAccordionItem.svelte'

  let checkboxValue = $state(false)
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

<IrisCheckbox value={checkboxValue} onchange={(next) => (checkboxValue = next)} />

<IrisAccordion>
  <IrisAccordionItem value="a" title="A">Panel A</IrisAccordionItem>
  <IrisAccordionItem value="b" title="B">Panel B</IrisAccordionItem>
</IrisAccordion>
