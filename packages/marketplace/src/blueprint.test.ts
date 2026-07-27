import { describe, expect, it } from 'vitest'
import { compilePageBlueprint, validatePageBlueprint, validateViewPreset } from './blueprint'
import type { IrisPageBlueprint } from './types'

const blueprint: IrisPageBlueprint = {
  schema: 'iris-ui/page-blueprint@1',
  id: 'sales-overview',
  version: '1.0.0',
  layout: 'grid',
  nodes: [
    {
      id: 'revenue',
      widget: 'stat',
      dataKey: 'revenue',
      props: { title: 'Revenue' },
    },
  ],
}

describe('page blueprints', () => {
  it('compiles only through an application-owned widget map', () => {
    const compiled = compilePageBlueprint(
      blueprint,
      { stat: Symbol('static import') },
      { revenue: 42 },
    )
    expect(compiled[0]!.data).toBe(42)
    expect(() => compilePageBlueprint(blueprint, {})).toThrow('local widget map')
  })

  it('rejects event handlers and component injection keys', () => {
    const unsafe: IrisPageBlueprint = {
      ...blueprint,
      nodes: [{ id: 'x', widget: 'stat', props: { onClick: 'run()', component: 'Remote' } }],
    }
    expect(validatePageBlueprint(unsafe).join(' ')).toContain('safe JSON')
  })

  it('validates view preset boundaries', () => {
    expect(
      validateViewPreset({
        schema: 'iris-ui/view-preset@1',
        id: 'dense-orders',
        version: '1.0.0',
        pageSize: 0,
      }),
    ).toContain('pageSize: must be a positive integer')
  })
})
