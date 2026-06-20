<script lang="ts">
  /**
   * The terminal view, wrapped so the catalog can supply the live app-name list.
   * The Window renders a manifest's `component` with no props, so this thin
   * wrapper (the `component` the catalog wires up) reads the catalog's app names
   * and threads them into the generic `<Terminal>`. Reading `CATALOG` here (at
   * component instantiation, not module-eval) keeps the catalog⇄terminal import
   * cycle harmless — mirroring how React reads `CATALOG.map` inside its render
   * thunk.
   */
  import { CATALOG } from '../catalog'
  import Terminal from './Terminal.svelte'

  const appNames = CATALOG.map((m) => m.name)
</script>

<Terminal {appNames} />
