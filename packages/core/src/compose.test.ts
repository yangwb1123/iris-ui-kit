import { describe, it, expect } from 'vitest'
import { composeFeatures, hasComposableFeatures, COMPOSE_ORDER } from './compose'

describe('composeFeatures', () => {
  it('returns empty for empty/undefined features', () => {
    expect(composeFeatures({})).toEqual([])
    expect(composeFeatures({ resizable: undefined })).toEqual([])
    expect(composeFeatures({ movable: false })).toEqual([])
  })

  it('orders capabilities in the fixed wrap order', () => {
    expect(
      composeFeatures({ resizable: {}, sortable: {}, hotkey: {}, movable: {}, clickOutside: {} }),
    ).toEqual(['hotkey', 'clickOutside', 'sortable', 'movable', 'resizable'])
  })

  it('ignores disabled features', () => {
    expect(composeFeatures({ resizable: {}, hotkey: false, sortable: undefined })).toEqual([
      'resizable',
    ])
  })

  it('COMPOSE_ORDER is the canonical outer-last order', () => {
    expect(COMPOSE_ORDER).toEqual(['hotkey', 'clickOutside', 'sortable', 'movable', 'resizable'])
  })
})

describe('hasComposableFeatures', () => {
  it('detects any enabled capability', () => {
    expect(hasComposableFeatures({})).toBe(false)
    expect(hasComposableFeatures({ hotkey: {} })).toBe(true)
    expect(hasComposableFeatures({ resizable: false })).toBe(false)
  })
})
