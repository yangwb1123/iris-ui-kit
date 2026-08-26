import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { GridClipboardModel, GridCore } from '@iris-ui-kit/core/grid'
import type { TableClipboardColumn } from '@iris-ui-kit/core'
import { useGridClipboard } from './useGridClipboard'
import { useGridCore } from './index'
import { useGridRange } from './useGridRange'
import { useGridRows } from './index'

type Row = { id: number; name: string }

const columns: TableClipboardColumn<Row>[] = [{ key: 'name', title: 'Name' }]

describe('useGridClipboard', () => {
  it('shares the feature-owned model and routes paste through the rows bridge', async () => {
    let core: GridCore<Row> | undefined
    let model: GridClipboardModel | undefined
    const Harness = defineComponent({
      setup() {
        core = useGridCore<Row>()
        const rows = useGridRows(core, [{ id: 1, name: 'Ada' }])
        useGridRange(core)
        const clipboard = useGridClipboard(core, { getColumns: () => columns })
        model = clipboard.model
        return () => h('span', rows.rows.value[0]?.name)
      },
    })

    const wrapper = mount(Harness)
    expect(core?.hasFeature('clipboard')).toBe(true)
    expect(core?.invoke('getClipboardModel')).toBe(model)
    core?.invoke('startCellRange', 0, 0)
    expect(model?.serialize()).toBe('Ada')
    expect(model?.paste('Grace')).toBe(true)
    await nextTick()
    expect(wrapper.text()).toBe('Grace')
    wrapper.unmount()
  })
})
