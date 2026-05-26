import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisPagination } from './Pagination'
import { getPageRange } from './types'

describe('getPageRange', () => {
  it('returns [1] for a single page', () => {
    expect(getPageRange(1, 1)).toEqual([1])
  })
  it('returns no ellipsis when total is small', () => {
    expect(getPageRange(3, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it('inserts right-only ellipsis near the start', () => {
    expect(getPageRange(1, 20)).toEqual([1, 2, 'ellipsis-right', 20])
  })
  it('inserts left-only ellipsis near the end', () => {
    expect(getPageRange(20, 20)).toEqual([1, 'ellipsis-left', 19, 20])
  })
  it('inserts both-sided ellipsis in the middle', () => {
    expect(getPageRange(10, 20)).toEqual([1, 'ellipsis-left', 9, 10, 11, 'ellipsis-right', 20])
  })
  it('skips the ellipsis when the gap is only one page', () => {
    // For total=7, current=4, sibling=1: kept = 1, 3,4,5, 7 — no ellipsis (gap=1 each side).
    expect(getPageRange(4, 7)).toEqual([1, 'ellipsis-left', 3, 4, 5, 'ellipsis-right', 7])
    // current=3 → left=2 → no left ellipsis
    expect(getPageRange(3, 7)).toEqual([1, 2, 3, 4, 'ellipsis-right', 7])
  })
  it('returns empty for total=0', () => {
    expect(getPageRange(1, 0)).toEqual([])
  })
})

describe('IrisPagination', () => {
  it('renders prev + next + numeric pages', () => {
    const w = mount(IrisPagination, { props: { modelValue: 1, total: 30, pageSize: 10 } })
    expect(w.find('[data-iris-pagination-item="prev"]').exists()).toBe(true)
    expect(w.find('[data-iris-pagination-item="next"]').exists()).toBe(true)
    expect(w.findAll('[data-iris-pagination-item="page"]')).toHaveLength(3)
  })

  it('highlights the active page', () => {
    const w = mount(IrisPagination, { props: { modelValue: 2, total: 30, pageSize: 10 } })
    const active = w.find('[data-iris-pagination-active="true"]')
    expect(active.exists()).toBe(true)
    expect(active.text()).toBe('2')
    expect(active.attributes('aria-current')).toBe('page')
  })

  it('clicking a page button emits update:modelValue', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisPagination, {
      props: { modelValue: 1, total: 30, pageSize: 10 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    const pages = w.findAll('[data-iris-pagination-item="page"]')
    await pages[2]!.trigger('click') // page 3
    expect(onUpdate).toHaveBeenLastCalledWith(3)
  })

  it('prev disabled at page 1', () => {
    const w = mount(IrisPagination, { props: { modelValue: 1, total: 30, pageSize: 10 } })
    expect(w.find('[data-iris-pagination-item="prev"]').attributes('disabled')).toBeDefined()
  })

  it('next disabled at last page', () => {
    const w = mount(IrisPagination, { props: { modelValue: 3, total: 30, pageSize: 10 } })
    expect(w.find('[data-iris-pagination-item="next"]').attributes('disabled')).toBeDefined()
  })

  it('next click moves to the next page', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisPagination, {
      props: { modelValue: 2, total: 30, pageSize: 10 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-pagination-item="next"]').trigger('click')
    expect(onUpdate).toHaveBeenLastCalledWith(3)
  })

  it('clamps an out-of-range modelValue to a valid page', () => {
    const w = mount(IrisPagination, { props: { modelValue: 99, total: 30, pageSize: 10 } })
    expect(w.find('[data-iris-pagination-active="true"]').text()).toBe('3')
  })

  it('shows first/last buttons when showFirstLast=true', () => {
    const w = mount(IrisPagination, {
      props: { modelValue: 5, total: 100, pageSize: 10, showFirstLast: true },
    })
    expect(w.find('[data-iris-pagination-item="first"]').exists()).toBe(true)
    expect(w.find('[data-iris-pagination-item="last"]').exists()).toBe(true)
  })

  it('renders ellipsis tokens in the right slot', () => {
    const w = mount(IrisPagination, { props: { modelValue: 10, total: 200, pageSize: 10 } })
    expect(w.find('[data-iris-pagination-ellipsis="left"]').exists()).toBe(true)
    expect(w.find('[data-iris-pagination-ellipsis="right"]').exists()).toBe(true)
  })

  it('disabled blocks navigation entirely', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisPagination, {
      props: { modelValue: 2, total: 100, pageSize: 10, disabled: true },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-pagination-item="next"]').trigger('click')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('has role="navigation" via <nav> + aria-label', () => {
    const w = mount(IrisPagination, { props: { modelValue: 1, total: 10, pageSize: 10 } })
    expect(w.element.tagName).toBe('NAV')
    expect(w.attributes('aria-label')).toBe('Pagination')
  })
})
