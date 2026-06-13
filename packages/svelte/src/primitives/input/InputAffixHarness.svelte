<script lang="ts">
  // Test fixture: IrisInput rendered with prefix/suffix snippets.
  import IrisInput from './Input.svelte'
</script>

<IrisInput>
  {#snippet prefix()}<span>$</span>{/snippet}
  {#snippet suffix()}<span>USD</span>{/snippet}
</IrisInput>
