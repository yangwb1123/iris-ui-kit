<script lang="ts">
  // Test fixture: drives IrisHeaderLayout with header/footer Snippets + children.
  import IrisHeaderLayout from './HeaderLayout.svelte'
</script>

<IrisHeaderLayout>
  {#snippet header()}<div data-h>H</div>{/snippet}
  {#snippet footer()}<div data-f>F</div>{/snippet}
  <div data-c>C</div>
</IrisHeaderLayout>
