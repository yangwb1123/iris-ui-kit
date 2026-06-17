<script lang="ts">
  // Dedicated cross-framework contract harness for IrisRating.
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): the
  // rating's accessible container carries role="slider" (with data-iris-rating),
  // and so does the IrisSlider thumb in the shared harness (data-iris-slider-thumb,
  // WITHOUT data-iris-rating). The shared *Slider* scenario asserts a globally
  // unique `[role="slider"]` (count === 1). Co-locating the rating in the same
  // container would make that count 2 and break the pre-existing slider contract,
  // which lives in @iris-ui/core/contracts and must not be changed. The rating's
  // own scenario uses the specific `[role="slider"][data-iris-rating]` selector,
  // so it is unaffected — we just keep the two slider-role elements in separate
  // containers, exactly like the React harness renders each contract in isolation.
  //
  // IrisRating is value-prop-driven (true controlled): clicking a star emits
  // `onchange` with the new value but `aria-valuenow` only flips when the parent
  // writes `value` back. Seed to 0 (the initial the shared Rating contract expects)
  // with max=5 and whole-star precision (allowHalf off), then write back from
  // `onchange` — same controlled-`$state` pattern as the other harness controls.
  import IrisRating from './primitives/rating/IrisRating.svelte'

  let ratingValue = $state(0)
</script>

<IrisRating value={ratingValue} max={5} label="Score" onchange={(next) => (ratingValue = next)} />
