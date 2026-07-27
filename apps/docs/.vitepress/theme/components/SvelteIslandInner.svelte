<script lang="ts">
  // SvelteIslandInner — the actual Svelte 5 component that SvelteIsland.svelte's
  // host mounts. It renders ONE selected @iris-ui-kit/svelte primitive (resolved by
  // name from the package namespace) with the live control props spread in, plus an
  // optional plain-text `children` snippet. This wrapper exists because Svelte 5
  // children are Snippets — you cannot pass a raw string child from `mount()` props,
  // so we declare the text slot here and render `{childText}` inside it.
  import type { Component } from 'svelte'
  import * as SvelteIris from '@iris-ui-kit/svelte'

  // A permissive Svelte-5 component type for the dynamically-resolved primitive
  // (props/exports are unknown at the call site, hence the loose generics).
  type AnyComponent = Component<Record<string, unknown>>

  interface Props {
    name: string
    componentProps: Record<string, unknown>
    childText?: string
  }
  let { name, componentProps, childText }: Props = $props()

  const Comp = $derived((SvelteIris as Record<string, unknown>)[name] as AnyComponent | undefined)
</script>

{#if Comp}
  {#if childText}
    <Comp {...componentProps}>
      {childText}
    </Comp>
  {:else}
    <Comp {...componentProps} />
  {/if}
{/if}
