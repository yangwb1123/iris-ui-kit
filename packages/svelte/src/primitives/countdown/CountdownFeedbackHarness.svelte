<script lang="ts">
  import IrisCountdown from './IrisCountdown.svelte'

  let {
    value,
    now,
    onfinish,
    replacement,
  }: { value: number; now?: number; onfinish?: () => void; replacement?: () => void } = $props()
  let finishCount = $state(0)
  let unrelatedCount = $state(0)
  let replaced = $state(false)

  function finish(): void {
    finishCount += 1
    onfinish?.()
  }
  function replacementFinish(): void {
    finishCount += 1
    replacement?.()
  }
</script>

<IrisCountdown {value} {now} onfinish={replaced ? replacementFinish : finish} />
<output data-finish-count>{finishCount}</output>
<button type="button" onclick={() => (unrelatedCount += 1)}>Unrelated: {unrelatedCount}</button>
<button type="button" onclick={() => (replaced = true)}>Replace callback</button>
