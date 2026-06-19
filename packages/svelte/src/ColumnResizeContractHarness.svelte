<script lang="ts">
  // Dedicated cross-framework contract harness for IrisTable's column resize.
  //
  // Mirrors the React reference (ResizeHarness): the first column ('name') width
  // is CONTROLLED at an initial 200 via `columnWidths` + `onColumnWidthsChange`,
  // and a probe element exposes the live width so the shared scenario's
  // `[data-col-width]` selector can read '200'/'216'/'200' in jsdom (which has no
  // layout). With the width controlled at 200, the table's resize handler reads
  // the explicit override (RESIZE_STEP === 16 across all adapters), so focusing
  // the first handle and pressing ArrowRight/ArrowLeft drives 200 → 216 → 200
  // deterministically. The width is held in a `$state` map and written back from
  // the change callback — the same controlled idiom as the other harness controls
  // (RangeSlider/Calendar).
  import IrisTable from './primitives/table/IrisTable.svelte'
  import type { IrisTableColumnWidths } from './primitives/table/types'

  let widths = $state<IrisTableColumnWidths>({ name: 200 })
</script>

<IrisTable
  resizableColumns
  columnWidths={widths}
  onColumnWidthsChange={(next) => (widths = next)}
  columns={[
    { key: 'name', title: 'Name' },
    { key: 'age', title: 'Age' },
  ]}
  data={[
    { id: '1', name: 'Charlie', age: 30 },
    { id: '2', name: 'Alpha', age: 25 },
    { id: '3', name: 'Bravo', age: 35 },
  ]}
/>
<div data-col-width={String(widths.name)}></div>
