<script lang="ts">
  // Test fixture: IrisAvatar with a custom fallbackContent snippet (the
  // snippet must win over derived initials when no image renders).
  import IrisAvatar from './Avatar.svelte'

  let { name = '' }: { name?: string } = $props()
</script>

<IrisAvatar {name}>
  {#snippet fallbackContent()}<span>USER</span>{/snippet}
</IrisAvatar>
