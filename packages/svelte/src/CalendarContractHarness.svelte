<script lang="ts">
  // Dedicated cross-framework contract harness for IrisCalendar's day-selection.
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): the
  // Calendar renders a full month of `[data-iris-calendar-day]` cells, each a
  // `role="gridcell"` button. Co-locating it in the shared harness would put
  // those many elements in the same container as the other contracts, risking
  // selector-count interactions. Keeping the calendar in its own container —
  // exactly like TreeContractHarness / TableSortContractHarness — mirrors how the
  // React harness renders each contract in isolation.
  //
  // IrisCalendar is `value`-CONTROLLED (a `Date | null`) + emits `onValueChange`,
  // so — exactly like the v-model wraps elsewhere — we hold local state here,
  // seeded to `initialValue` (null = nothing selected initially), and write the
  // emitted date back. `defaultMonth` is fixed to June 2024 so the day cells are
  // deterministic (`data-iris-calendar-day-iso="2024-06-10"` / `"2024-06-20"`),
  // exactly what the shared calendarScenario asserts. The optional `min`/`max`/
  // `locale` overrides serve the keyboard-roving scenario (`calendarNavScenario`),
  // which mounts a seeded value + bounds. Constructing a Date here is fine —
  // this is test infra, not a workflow script.
  import IrisCalendar from './primitives/calendar/IrisCalendar.svelte'

  interface Props {
    initialValue?: Date | null
    min?: Date
    max?: Date
    locale?: string
  }

  let { initialValue = null, min, max, locale }: Props = $props()

  // svelte-ignore state_referenced_locally
  let selected = $state<Date | null>(initialValue)
</script>

<IrisCalendar
  value={selected}
  onValueChange={(d) => (selected = d)}
  defaultMonth={new Date(2024, 5, 1)}
  {min}
  {max}
  {locale}
/>
