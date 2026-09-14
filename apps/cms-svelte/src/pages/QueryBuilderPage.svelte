<script lang="ts">
  import {
    IrisQueryBuilder,
    createFilterBuilder,
    type CompiledQueryGroup,
    type FilterRule,
    type QueryColumn,
  } from '@iris-ui-kit/plugin-query-builder/svelte'

  const columns: QueryColumn[] = [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'age', label: 'Age', type: 'number' },
    {
      key: 'role',
      label: 'Role',
      type: 'enum',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' },
      ],
    },
  ]

  const builder = createFilterBuilder({
    columns,
    initialQuery: {
      type: 'group',
      id: 'query-root',
      combinator: 'and',
      children: [],
    },
  })

  let compiledRules = $state<FilterRule[]>([])
  let recursiveQuery = $state<CompiledQueryGroup>(builder.toQuery())
  let onChangeReceived = $state(false)
  let onQueryChangeReceived = $state(false)
  const callbackStatus = $derived(
    `${onChangeReceived ? 'onChange: received' : 'onChange: pending'}; ${onQueryChangeReceived ? 'onQueryChange: received' : 'onQueryChange: pending'}`,
  )

  function handleChange(rules: FilterRule[]): void {
    compiledRules = rules
    onChangeReceived = true
  }

  function handleQueryChange(query: CompiledQueryGroup): void {
    recursiveQuery = query
    onQueryChangeReceived = true
  }
</script>

<section data-page="query-builder-example">
  <h1 class="page-title">Query Builder Example</h1>
  <p class="page-desc">
    Build a user-access filter with typed values: start with <strong>age at least 30</strong>, then
    add a nested OR group for users whose role is Admin.
  </p>

  <div class="query-builder-layout">
    <section class="query-builder-panel" aria-labelledby="query-builder-controls-heading">
      <h2 id="query-builder-controls-heading">User-access filter</h2>
      <p class="query-builder-help">
        Add rules and groups with the native Svelte adapter. Invalid editable rows stay visible while
        invalid values are excluded from the compiled output.
      </p>
      <IrisQueryBuilder
        {builder}
        onChange={handleChange}
        onQueryChange={handleQueryChange}
      />
    </section>

    <section class="query-builder-panel" aria-labelledby="query-builder-results-heading">
      <h2 id="query-builder-results-heading">Live results</h2>
      <div class="query-builder-readouts">
        <div class="query-builder-readout-row">
          <span class="query-builder-readout-label">Compiled rules</span>
          <output
            data-iris-query-builder-compiled-rules
            aria-label="Compiled rules"
            aria-live="polite"
            class="query-builder-readout"
          >{JSON.stringify(compiledRules)}</output>
        </div>
        <div class="query-builder-readout-row">
          <span class="query-builder-readout-label">Recursive query</span>
          <output
            data-iris-query-builder-recursive-query
            aria-label="Recursive query"
            aria-live="polite"
            class="query-builder-readout"
          >{JSON.stringify(recursiveQuery)}</output>
        </div>
        <div class="query-builder-readout-row">
          <span class="query-builder-readout-label">Compiled rule count</span>
          <output
            data-iris-query-builder-rule-count
            aria-label="Compiled rule count"
            aria-live="polite"
            class="query-builder-readout"
          >{compiledRules.length}</output>
        </div>
        <div class="query-builder-readout-row">
          <span class="query-builder-readout-label">Callback status</span>
          <output
            data-iris-query-builder-callback-status
            aria-label="Callback status"
            aria-live="polite"
            class="query-builder-readout"
          >{callbackStatus}</output>
        </div>
      </div>
    </section>
  </div>
</section>

<style>
  section[data-page='query-builder-example'] {
    max-width: 960px;
  }

  .query-builder-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
    gap: var(--iris-space-md, 16px);
    align-items: start;
  }

  .query-builder-panel {
    min-width: 0;
    padding: var(--iris-space-md, 16px);
    border: 1px solid var(--iris-border);
    border-radius: var(--iris-radius-md, 6px);
    background: var(--iris-surface);
  }

  .query-builder-panel h2 {
    margin: 0 0 var(--iris-space-xs, 4px);
    font-size: var(--iris-font-size-lg, 16px);
  }

  .query-builder-help {
    margin: 0 0 var(--iris-space-md, 16px);
    color: var(--iris-muted);
    font-size: var(--iris-font-size-sm, 13px);
    line-height: 1.5;
  }

  .query-builder-readouts {
    display: grid;
    gap: var(--iris-space-md, 16px);
  }

  .query-builder-readout-row {
    display: grid;
    gap: var(--iris-space-xs, 4px);
  }

  .query-builder-readout-label {
    color: var(--iris-muted);
    font-size: var(--iris-font-size-sm, 13px);
    font-weight: 600;
  }

  .query-builder-readout {
    display: block;
    min-height: var(--iris-space-3xl, 48px);
    padding: var(--iris-space-sm, 12px);
    border: 1px solid var(--iris-border);
    border-radius: var(--iris-radius-md, 6px);
    background: var(--iris-background);
    color: var(--iris-foreground);
    font-family: var(--iris-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: var(--iris-font-size-sm, 13px);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  @media (max-width: 760px) {
    .query-builder-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
