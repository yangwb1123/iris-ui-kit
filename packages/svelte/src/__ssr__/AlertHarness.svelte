<script lang="ts">
  // SSR fixture: IrisAlert with a title and body content.
  //
  // IrisAlert uses an untyped `$props()` rune, so svelte-check infers its
  // optional props (`onclose`/`style`/`icon`/`titleSlot`) as required at the
  // template call site. We pass them explicitly as `undefined` to satisfy the
  // strict check WITHOUT touching the production component — at runtime these
  // are exactly the defaults the component would use anyway.
  import IrisAlert from '../primitives/alert/IrisAlert.svelte'

  type AlertTone = 'info' | 'success' | 'warning' | 'danger'

  let { tone = 'info' as AlertTone, title = 'Heads up' }: { tone?: AlertTone; title?: string } =
    $props()
</script>

<IrisAlert
  {tone}
  {title}
  onclose={undefined}
  style={undefined}
  icon={undefined}
  titleSlot={undefined}
>
  Body text
</IrisAlert>
