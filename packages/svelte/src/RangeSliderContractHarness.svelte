<script lang="ts">
  // Dedicated cross-framework contract harness for IrisRangeSlider.
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): the
  // range slider renders TWO `[data-iris-range-slider-thumb]` elements, each with
  // role="slider". The shared harness already hosts the single IrisSlider, whose
  // thumb is also role="slider", and the shared *Slider* scenario asserts a
  // globally-unique `[role="slider"]` (count === 1). Co-locating the range slider
  // there would make that count 3 and break the pre-existing Slider contract,
  // which lives in @iris-ui/core/contracts and must not be changed. Keeping the
  // range slider in its own container mirrors the React harness, which renders
  // each contract in isolation. (RatingContractHarness.svelte exists for the same
  // role="slider" collision reason.)
  //
  // IrisRangeSlider is value-prop-driven (true controlled): an ArrowRight/Left on
  // a thumb emits `onchange` with the next `[start, end]` pair, but each thumb's
  // `aria-valuenow` only flips when the parent writes `value` back. Seed to
  // [20, 80] (the initial the shared RangeSlider contract expects) with
  // min=0 max=100 step=10, then write back from `onchange` — same controlled
  // `$state` pattern as the other harness controls.
  import IrisRangeSlider from './primitives/range-slider/IrisRangeSlider.svelte'

  let value = $state<[number, number]>([20, 80])
</script>

<IrisRangeSlider {value} min={0} max={100} step={10} onchange={(next) => (value = next)} />
