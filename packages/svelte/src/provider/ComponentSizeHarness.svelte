<script lang="ts">
  // Test fixture: real size-bearing controls rendered under one <IrisProvider>,
  // so provider inheritance is proven through actual DOM, not a context probe.
  import IrisProvider from './IrisProvider.svelte'
  import IrisButton from '../primitives/button/IrisButton.svelte'
  import IrisInput from '../primitives/input/Input.svelte'
  import IrisNumberInput from '../primitives/number-input/IrisNumberInput.svelte'
  import IrisTextarea from '../primitives/textarea/IrisTextarea.svelte'
  import IrisSwitch from '../primitives/switch/Switch.svelte'
  import IrisCheckbox from '../primitives/checkbox/IrisCheckbox.svelte'
  import IrisRadio from '../primitives/radio/IrisRadio.svelte'
  import IrisRadioGroup from '../primitives/radio/IrisRadioGroup.svelte'
  import IrisSelect from '../primitives/select/IrisSelect.svelte'
  import IrisCombobox from '../primitives/combobox/IrisCombobox.svelte'
  import IrisToggleGroup from '../primitives/toggle-group/IrisToggleGroup.svelte'
  import IrisToggleGroupItem from '../primitives/toggle-group/IrisToggleGroupItem.svelte'
  import IrisDatePicker from '../primitives/date-picker/IrisDatePicker.svelte'
  import IrisMonthPicker from '../primitives/month-picker/IrisMonthPicker.svelte'
  import type { IrisComponentSize } from './componentSize'

  let {
    componentSize,
    explicit,
    noProvider = false,
  }: {
    componentSize?: IrisComponentSize
    /** Explicit per-control override, applied to Button / Input / Switch. */
    explicit?: IrisComponentSize
    /** Render the controls with no provider at all (baseline `md`). */
    noProvider?: boolean
  } = $props()

  const items = [{ value: 'a', label: 'A' }]
</script>

{#snippet controls()}
  <IrisButton size={explicit}>x</IrisButton>
  <IrisInput size={explicit} />
  <IrisNumberInput size={explicit} />
  <IrisTextarea size={explicit} />
  <IrisSwitch size={explicit} aria-label="s" />
  <IrisCheckbox size={explicit} aria-label="c" />
  <IrisRadioGroup>
    <IrisRadio value="a" size={explicit} />
  </IrisRadioGroup>
  <IrisSelect {items} size={explicit} />
  <IrisCombobox options={[]} size={explicit} />
  <IrisToggleGroup size={explicit}>
    <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
  </IrisToggleGroup>
  <IrisDatePicker size={explicit} />
  <IrisMonthPicker size={explicit} />
{/snippet}

{#if noProvider}
  {@render controls()}
{:else}
  <IrisProvider {componentSize}>
    {@render controls()}
  </IrisProvider>
{/if}
