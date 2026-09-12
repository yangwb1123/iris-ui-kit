import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import {
  createGridCore,
  createGridRangeFeature,
  createGridRowsFeature,
  type GridClipboardModel,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import GridClipboardHarness from './GridClipboardHarness.svelte'
import { useGridClipboard, type UseGridClipboardOptions } from './useGridClipboard'

type Row = { id: number; name: string }
const columns = [{ key: 'name', title: 'Name' }]

function createClipboardBridge(
  options: Pick<UseGridClipboardOptions<Row>, 'resolveValue' | 'parseValue'>,
) {
  const core = createGridCore<Row>({
    features: [
      createGridRowsFeature<Row>({ defaultRows: [{ id: 1, name: 'Ada' }] }),
      createGridRangeFeature<Row>(),
    ],
  })
  const clipboard = useGridClipboard(core, { getColumns: () => columns, ...options })
  core.invoke('startCellRange', 0, 0)
  return { core, clipboard }
}

describe('useGridClipboard', () => {
  it('shares the feature-owned model and routes paste through the rows bridge', async () => {
    let core: GridCore<{ id: number; name: string }> | undefined
    let model: GridClipboardModel | undefined
    const view = render(GridClipboardHarness, {
      capture: (nextCore, nextModel) => {
        core = nextCore
        model = nextModel
      },
    })

    const selectButton = view.getByRole('button', { name: 'null' })
    expect(core?.hasFeature('clipboard')).toBe(true)
    expect(core?.invoke('getClipboardModel')).toBe(model)
    expect(selectButton.dataset.clipboard).toBe('true')

    await selectButton.click()
    expect(selectButton.textContent?.trim()).toBe('Ada')
    await view.getByRole('button', { name: 'paste' }).click()
    expect(view.getByTestId('row').textContent).toBe('Grace')
    view.unmount()
  })

  it.each([null, undefined] as const)('preserves a %s resolveValue result', (value) => {
    const { core, clipboard } = createClipboardBridge({ resolveValue: () => value })
    try {
      expect(clipboard.serialize()).toBe('')
    } finally {
      core.destroy()
    }
  })

  it.each([null, undefined] as const)(
    'preserves a %s parseValue result in the rows bridge',
    (value) => {
      const { core, clipboard } = createClipboardBridge({ parseValue: () => value })
      try {
        expect(clipboard.paste('Grace')).toBe(true)
        const rows = core.invoke<Row[]>('getRows')
        expect(rows).toHaveLength(1)
        const row = rows[0]!
        expect(row.name).toBe(value)
        if (value === undefined) {
          expect(Object.prototype.hasOwnProperty.call(row, 'name')).toBe(true)
        }
      } finally {
        core.destroy()
      }
    },
  )
})
