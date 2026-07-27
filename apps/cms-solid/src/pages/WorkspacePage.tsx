import { createSignal, For, onCleanup, Show, type JSX } from 'solid-js'
import { createCmsWorkspaceController, type CmsWorkspaceRoute } from '@iris-ui-kit/cms-shared'
import { IrisBadge, IrisButton, IrisInput } from '@iris-ui-kit/solid'

export function WorkspacePage(props: { routeKey: CmsWorkspaceRoute }): JSX.Element {
  const controller = createCmsWorkspaceController(props.routeKey)
  const definition = controller.definition
  const [snapshot, setSnapshot] = createSignal(controller.store.getState())
  onCleanup(controller.store.subscribe(setSnapshot))

  const rows = () => {
    void snapshot()
    return controller.visibleRecords()
  }
  const selected = () => {
    void snapshot()
    return controller.selectedRecord()
  }
  const period = (): string | undefined => definition.periods?.[snapshot().periodIndex]

  return (
    <section data-cms-workspace={props.routeKey}>
      <header class="cms-workspace-header">
        <div>
          <h1 class="page-title">{definition.title}</h1>
          <p class="page-desc">{definition.description}</p>
        </div>
        <IrisButton variant="solid" onClick={controller.runPrimaryAction}>
          {definition.primaryActionLabel}
        </IrisButton>
      </header>

      <Show when={snapshot().metrics.length > 0}>
        <div class="cms-workspace-metrics" aria-label="Current metrics">
          <For each={snapshot().metrics}>
            {(metric) => (
              <article class="cms-workspace-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <IrisBadge tone={metric.tone} variant="subtle">
                  {metric.delta}
                </IrisBadge>
              </article>
            )}
          </For>
        </div>
      </Show>

      <Show when={period()}>
        {(activePeriod) => (
          <div class="cms-workspace-period" aria-label="Calendar period">
            <IrisButton
              variant="outline"
              size="sm"
              aria-label="Previous period"
              onClick={() => controller.shiftPeriod(-1)}
            >
              Previous
            </IrisButton>
            <strong aria-live="polite">{activePeriod()}</strong>
            <IrisButton
              variant="outline"
              size="sm"
              aria-label="Next period"
              onClick={() => controller.shiftPeriod(1)}
            >
              Next
            </IrisButton>
          </div>
        )}
      </Show>

      <div class="cms-workspace-toolbar">
        <IrisInput
          type="search"
          value={snapshot().query}
          onInput={(event) => controller.setQuery(event.currentTarget.value)}
          placeholder={definition.searchPlaceholder}
          aria-label={`Search ${definition.title}`}
          style={{ width: 'min(100%, 320px)' }}
        />
        <label class="cms-workspace-filter">
          <span>View</span>
          <select
            value={snapshot().filter}
            aria-label={`Filter ${definition.title}`}
            onChange={(event) => controller.setFilter(event.currentTarget.value)}
          >
            <For each={definition.filters}>
              {(filter) => <option value={filter.value}>{filter.label}</option>}
            </For>
          </select>
        </label>
      </div>

      <Show when={snapshot().notice}>
        {(notice) => (
          <div class="cms-workspace-notice" role="status">
            {notice()}
          </div>
        )}
      </Show>

      <Show
        when={rows().length > 0}
        fallback={
          <p class="cms-workspace-empty" role="status">
            {definition.emptyMessage}
          </p>
        }
      >
        <div class="cms-workspace-table-shell">
          <table class="cms-table">
            <thead>
              <tr>
                <For each={definition.columns}>{(column) => <th scope="col">{column}</th>}</For>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <For each={rows()}>
                {(item) => (
                  <tr data-selected={snapshot().selectedId === item.id || undefined}>
                    <For each={item.cells}>
                      {(cell, index) => (
                        <td>
                          <Show when={index() === 0} fallback={cell}>
                            <button
                              class="cms-workspace-link"
                              type="button"
                              onClick={() => controller.select(item.id)}
                            >
                              {cell}
                            </button>
                          </Show>
                        </td>
                      )}
                    </For>
                    <td>
                      <IrisBadge tone={item.tone} variant="subtle">
                        {item.status}
                      </IrisBadge>
                    </td>
                    <td>
                      <IrisButton
                        variant="ghost"
                        size="sm"
                        onClick={() => controller.runRowAction(item.id)}
                      >
                        {definition.rowActionLabel}
                      </IrisButton>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={selected()}>
        {(item) => (
          <aside class="cms-workspace-selection" aria-label="Selected record">
            <strong>Selected: {item().cells[0]}</strong>
            <span>
              {definition.columns
                .slice(1)
                .map((column, index) => `${column}: ${item().cells[index + 1]}`)
                .join(' · ')}
            </span>
          </aside>
        )}
      </Show>
    </section>
  )
}
