<script lang="ts">
  // Test fixture: IrisBadge needs text children (a Snippet).
  import IrisBadge from './Badge.svelte'
  import type { IrisBadgeTone, IrisBadgeVariant } from './types'

  let { tone, variant }: { tone?: IrisBadgeTone; variant?: IrisBadgeVariant } = $props()
</script>

<IrisBadge {tone} {variant}>new</IrisBadge>
