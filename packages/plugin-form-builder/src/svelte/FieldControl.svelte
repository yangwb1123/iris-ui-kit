<script lang="ts">
  import type { FieldSpec } from '../core'
  import ScalarField from './ScalarField.svelte'
  import ArrayField from './ArrayField.svelte'

  // Render one schema field — dispatch to `ArrayField` for repeaters, else a
  // `ScalarField`. `prefix` is set when rendering a sub-field inside an array row
  // so the control binds to its nested path (mirrors the React `FieldControl`).
  let { field, prefix }: { field: FieldSpec; prefix?: string } = $props()
</script>

{#if field.type === 'array' && !prefix}
  <ArrayField {field} />
{:else}
  <ScalarField {field} {prefix} />
{/if}
