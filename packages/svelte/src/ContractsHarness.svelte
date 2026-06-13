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
  import IrisSegmented from './primitives/segmented/IrisSegmented.svelte'
  import IrisToggleGroup from './primitives/toggle-group/IrisToggleGroup.svelte'
  import IrisToggleGroupItem from './primitives/toggle-group/IrisToggleGroupItem.svelte'
  import IrisSlider from './primitives/slider/IrisSlider.svelte'
  import IrisRadioGroup from './primitives/radio/IrisRadioGroup.svelte'
  import IrisRadio from './primitives/radio/IrisRadio.svelte'
  import IrisNumberInput from './primitives/number-input/IrisNumberInput.svelte'
  import IrisPagination from './primitives/pagination/IrisPagination.svelte'
  import IrisStepper from './primitives/stepper/IrisStepper.svelte'
  import IrisStepperStep from './primitives/stepper/IrisStepperStep.svelte'

  let checkboxValue = $state(false)

  // Segmented / ToggleGroup / Slider are value-prop-driven (true controlled
  // semantics: a click/key emits onchange but the DOM only flips when the parent
  // writes `value` back). To present the UNCONTROLLED initial state the shared
  // contracts expect (segmented/toggle-group `defaultValue="a"`; slider
  // `defaultValue={50}`), we hold local state here — seeded to that initial —
  // and write it back from `onchange`, exactly like the checkbox wrap above.
  let segmentedValue = $state('a')
  let toggleGroupValue = $state<string | string[] | null>('a')
  let sliderValue = $state(50)

  // IrisRadioGroup is true controlled too: a radio click emits the group's
  // `onchange` but the DOM `data-state` only flips when the parent writes `value`
  // back. Seed to 'a' (first checked) to present the uncontrolled initial the
  // shared radio contract expects, then write back from `onchange`.
  let radioValue = $state<string | number | boolean>('a')

  // IrisNumberInput is value-prop-driven too: clicking inc/dec emits `onchange`
  // but the spinbutton's `aria-valuenow` only flips when the parent writes
  // `value` back. Seed to 5 (the initial the shared NumberInput contract
  // expects) with min=0 max=10 step=1, then write back from `onchange`.
  let numberValue = $state<number | null>(5)

  // IrisPagination is value-prop-driven too: clicking a page button emits
  // `onchange` but `aria-current="page"` only moves when the parent writes
  // `value` back. Seed to 1 (page 1 current, the initial the shared Pagination
  // contract expects) over total=30 pageSize=10 (→ exactly 3 page buttons),
  // then write back from `onchange`.
  let pageValue = $state(1)

  // IrisStepper is value-prop-driven too: clicking a step trigger emits
  // `onchange` but `aria-current="step"` only moves when the parent writes
  // `value` back. Seed to 0 (step 0 active, the initial the shared Stepper
  // contract expects) over 3 IrisStepperStep children with linear={false}
  // (any step directly clickable), then write back from `onchange`.
  let stepperValue = $state(0)
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

<IrisSegmented
  options={[
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
    { label: 'C', value: 'c' },
  ]}
  value={segmentedValue}
  onchange={(next) => (segmentedValue = next)}
/>

<IrisToggleGroup
  type="single"
  value={toggleGroupValue}
  onchange={(next) => (toggleGroupValue = next)}
>
  <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
  <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
  <IrisToggleGroupItem value="c">C</IrisToggleGroupItem>
</IrisToggleGroup>

<IrisSlider
  value={sliderValue}
  min={0}
  max={100}
  step={10}
  onchange={(next) => (sliderValue = next)}
/>

<IrisRadioGroup value={radioValue} onchange={(next) => (radioValue = next)}>
  <IrisRadio value="a">A</IrisRadio>
  <IrisRadio value="b">B</IrisRadio>
  <IrisRadio value="c">C</IrisRadio>
</IrisRadioGroup>

<IrisNumberInput
  value={numberValue}
  min={0}
  max={10}
  step={1}
  aria-label="Quantity"
  onchange={(next) => (numberValue = next)}
/>

<IrisPagination
  value={pageValue}
  total={30}
  pageSize={10}
  onchange={(next) => (pageValue = next)}
/>

<IrisStepper
  value={stepperValue}
  linear={false}
  onchange={(next) => (stepperValue = next)}
>
  <IrisStepperStep title="Step 1" />
  <IrisStepperStep title="Step 2" />
  <IrisStepperStep title="Step 3" />
</IrisStepper>
