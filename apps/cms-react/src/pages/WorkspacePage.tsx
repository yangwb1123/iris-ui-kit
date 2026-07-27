import { useMemo, useSyncExternalStore } from 'react'
import { createCmsWorkspaceController, type CmsWorkspaceRoute } from '@iris-ui-kit/cms-shared'
import { IrisBadge, IrisButton, IrisInput } from '@iris-ui-kit/react'

export function WorkspacePage({ routeKey }: { routeKey: CmsWorkspaceRoute }) {
  const controller = useMemo(() => createCmsWorkspaceController(routeKey), [routeKey])
  const snapshot = useSyncExternalStore(
    controller.store.subscribe,
    controller.store.getState,
    controller.store.getState,
  )
  const definition = controller.definition
  const rows = controller.visibleRecords()
  const selected = controller.selectedRecord()
  const period = definition.periods?.[snapshot.periodIndex]

  return (
    <section data-cms-workspace={routeKey}>
      <header className="cms-workspace-header">
        <div>
          <h1 className="page-title">{definition.title}</h1>
          <p className="page-desc">{definition.description}</p>
        </div>
        <IrisButton variant="solid" onClick={controller.runPrimaryAction}>
          {definition.primaryActionLabel}
        </IrisButton>
      </header>

      {snapshot.metrics.length > 0 && (
        <div className="cms-workspace-metrics" aria-label="Current metrics">
          {snapshot.metrics.map((metric) => (
            <article className="cms-workspace-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <IrisBadge tone={metric.tone} variant="subtle">
                {metric.delta}
              </IrisBadge>
            </article>
          ))}
        </div>
      )}

      {period && (
        <div className="cms-workspace-period" aria-label="Calendar period">
          <IrisButton
            variant="outline"
            size="sm"
            aria-label="Previous period"
            onClick={() => controller.shiftPeriod(-1)}
          >
            Previous
          </IrisButton>
          <strong aria-live="polite">{period}</strong>
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

      <div className="cms-workspace-toolbar">
        <IrisInput
          type="search"
          value={snapshot.query}
          onChange={(event) => controller.setQuery(event.target.value)}
          placeholder={definition.searchPlaceholder}
          aria-label={`Search ${definition.title}`}
          style={{ width: 'min(100%, 320px)' }}
        />
        <label className="cms-workspace-filter">
          <span>View</span>
          <select
            value={snapshot.filter}
            aria-label={`Filter ${definition.title}`}
            onChange={(event) => controller.setFilter(event.target.value)}
          >
            {definition.filters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {snapshot.notice && (
        <div className="cms-workspace-notice" role="status">
          {snapshot.notice}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="cms-workspace-table-shell">
          <table className="cms-table">
            <thead>
              <tr>
                {definition.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} data-selected={snapshot.selectedId === item.id || undefined}>
                  {item.cells.map((cell, index) => (
                    <td key={definition.columns[index]}>
                      {index === 0 ? (
                        <button
                          className="cms-workspace-link"
                          type="button"
                          onClick={() => controller.select(item.id)}
                        >
                          {cell}
                        </button>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="cms-workspace-empty" role="status">
          {definition.emptyMessage}
        </p>
      )}

      {selected && (
        <aside className="cms-workspace-selection" aria-label="Selected record">
          <strong>Selected: {selected.cells[0]}</strong>
          <span>
            {definition.columns
              .slice(1)
              .map((column, index) => `${column}: ${selected.cells[index + 1]}`)
              .join(' · ')}
          </span>
        </aside>
      )}
    </section>
  )
}
