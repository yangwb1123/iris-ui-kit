<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { createCmsWorkspaceController, type CmsWorkspaceRoute } from '@iris-ui-kit/cms-shared'
  import { IrisBadge, IrisButton, IrisInput } from '@iris-ui-kit/svelte'

  let { routeKey }: { routeKey: CmsWorkspaceRoute } = $props()
  const controller = createCmsWorkspaceController(untrack(() => routeKey))
  const definition = controller.definition
  let snapshot = $state(controller.store.getState())
  const unsubscribe = controller.store.subscribe((next) => {
    snapshot = next
  })
  onDestroy(unsubscribe)

  const rows = $derived.by(() => {
    void snapshot
    return controller.visibleRecords()
  })
  const selected = $derived.by(() => {
    void snapshot
    return controller.selectedRecord()
  })
  const period = $derived(definition.periods?.[snapshot.periodIndex])
</script>

<section data-cms-workspace={routeKey}>
  <header class="cms-workspace-header">
    <div>
      <h1 class="page-title">{definition.title}</h1>
      <p class="page-desc">{definition.description}</p>
    </div>
    <IrisButton variant="solid" onclick={controller.runPrimaryAction}>
      {definition.primaryActionLabel}
    </IrisButton>
  </header>

  {#if snapshot.metrics.length > 0}
    <div class="cms-workspace-metrics" aria-label="Current metrics">
      {#each snapshot.metrics as metric (metric.label)}
        <article class="cms-workspace-metric">
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <IrisBadge tone={metric.tone} variant="subtle">{metric.delta}</IrisBadge>
        </article>
      {/each}
    </div>
  {/if}

  {#if period}
    <div class="cms-workspace-period" aria-label="Calendar period">
      <IrisButton
        variant="outline"
        size="sm"
        aria-label="Previous period"
        onclick={() => controller.shiftPeriod(-1)}
      >
        Previous
      </IrisButton>
      <strong aria-live="polite">{period}</strong>
      <IrisButton
        variant="outline"
        size="sm"
        aria-label="Next period"
        onclick={() => controller.shiftPeriod(1)}
      >
        Next
      </IrisButton>
    </div>
  {/if}

  <div class="cms-workspace-toolbar">
    <IrisInput
      type="search"
      value={snapshot.query}
      oninput={(event) => controller.setQuery(event.currentTarget.value)}
      placeholder={definition.searchPlaceholder}
      aria-label={`Search ${definition.title}`}
      style="width: min(100%, 320px)"
    />
    <label class="cms-workspace-filter">
      <span>View</span>
      <select
        value={snapshot.filter}
        aria-label={`Filter ${definition.title}`}
        onchange={(event) => controller.setFilter(event.currentTarget.value)}
      >
        {#each definition.filters as filter (filter.value)}
          <option value={filter.value}>{filter.label}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if snapshot.notice}
    <div class="cms-workspace-notice" role="status">{snapshot.notice}</div>
  {/if}

  {#if rows.length > 0}
    <div class="cms-workspace-table-shell">
      <table class="cms-table">
        <thead>
          <tr>
            {#each definition.columns as column (column)}
              <th scope="col">{column}</th>
            {/each}
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as item (item.id)}
            <tr data-selected={snapshot.selectedId === item.id || undefined}>
              {#each item.cells as cell, index (definition.columns[index])}
                <td>
                  {#if index === 0}
                    <button
                      class="cms-workspace-link"
                      type="button"
                      onclick={() => controller.select(item.id)}
                    >
                      {cell}
                    </button>
                  {:else}
                    {cell}
                  {/if}
                </td>
              {/each}
              <td><IrisBadge tone={item.tone} variant="subtle">{item.status}</IrisBadge></td>
              <td>
                <IrisButton
                  variant="ghost"
                  size="sm"
                  onclick={() => controller.runRowAction(item.id)}
                >
                  {definition.rowActionLabel}
                </IrisButton>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="cms-workspace-empty" role="status">{definition.emptyMessage}</p>
  {/if}

  {#if selected}
    <aside class="cms-workspace-selection" aria-label="Selected record">
      <strong>Selected: {selected.cells[0]}</strong>
      <span>
        {definition.columns
          .slice(1)
          .map((column, index) => `${column}: ${selected.cells[index + 1]}`)
          .join(' · ')}
      </span>
    </aside>
  {/if}
</section>
