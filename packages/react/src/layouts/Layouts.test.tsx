import * as React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisStack } from './Stack'
import { IrisContainer } from './Container'
import { IrisGrid } from './Grid'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisStack', () => {
  it('renders a flex container with token gap (md → var(--iris-gap-md))', () => {
    const { container } = render(
      <IrisStack>
        <span>a</span>
      </IrisStack>,
    )
    const el = container.querySelector('[data-iris-stack]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.style.display).toBe('flex')
    expect(el.style.flexDirection).toBe('column')
    expect(el.style.gap).toBe('var(--iris-gap-md)')
  })

  it('numeric spacing becomes px', () => {
    const { container } = render(<IrisStack spacing={8}>x</IrisStack>)
    expect((container.querySelector('[data-iris-stack]') as HTMLElement).style.gap).toBe('8px')
  })

  it('arbitrary spacing string passes through', () => {
    const { container } = render(<IrisStack spacing="1.5rem">x</IrisStack>)
    expect((container.querySelector('[data-iris-stack]') as HTMLElement).style.gap).toBe('1.5rem')
  })

  it('direction prop reflects on style and data attr', () => {
    const { container } = render(<IrisStack direction="row">x</IrisStack>)
    const el = container.querySelector('[data-iris-stack]') as HTMLElement
    expect(el.style.flexDirection).toBe('row')
    expect(el.getAttribute('data-iris-stack-direction')).toBe('row')
  })

  it('align/justify/wrap propagate', () => {
    const { container } = render(
      <IrisStack align="center" justify="between" wrap>
        x
      </IrisStack>,
    )
    const el = container.querySelector('[data-iris-stack]') as HTMLElement
    expect(el.style.alignItems).toBe('center')
    expect(el.style.justifyContent).toBe('space-between')
    expect(el.style.flexWrap).toBe('wrap')
  })

  it('inline mode uses inline-flex', () => {
    const { container } = render(<IrisStack inline>x</IrisStack>)
    expect((container.querySelector('[data-iris-stack]') as HTMLElement).style.display).toBe(
      'inline-flex',
    )
  })

  it('user style merges last (overrides defaults)', () => {
    const { container } = render(<IrisStack style={{ padding: '10px' }}>x</IrisStack>)
    expect((container.querySelector('[data-iris-stack]') as HTMLElement).style.padding).toBe('10px')
  })
})

describe('@iris-ui-kit/react IrisContainer', () => {
  it('renders centered with default lg max-width', () => {
    const { container } = render(<IrisContainer>x</IrisContainer>)
    const el = container.querySelector('[data-iris-container]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.style.maxWidth).toBe('1024px')
    // Centered via logical margins (RTL-safe).
    expect(el.style.marginInlineStart).toBe('auto')
    expect(el.style.marginInlineEnd).toBe('auto')
  })

  it('maxWidth shorthand maps to px breakpoint', () => {
    const { container } = render(<IrisContainer maxWidth="sm">x</IrisContainer>)
    expect((container.querySelector('[data-iris-container]') as HTMLElement).style.maxWidth).toBe(
      '640px',
    )
  })

  it('maxWidth raw value passes through', () => {
    const { container } = render(<IrisContainer maxWidth="1440px">x</IrisContainer>)
    expect((container.querySelector('[data-iris-container]') as HTMLElement).style.maxWidth).toBe(
      '1440px',
    )
  })

  it('center=false omits auto margins', () => {
    const { container } = render(<IrisContainer center={false}>x</IrisContainer>)
    const el = container.querySelector('[data-iris-container]') as HTMLElement
    expect(el.style.marginInlineStart).not.toBe('auto')
  })

  it('numeric padding becomes px', () => {
    const { container } = render(<IrisContainer padding={20}>x</IrisContainer>)
    expect((container.querySelector('[data-iris-container]') as HTMLElement).style.padding).toBe(
      '0px 20px',
    )
  })

  it('token padding becomes var(--iris-padding-*)', () => {
    const { container } = render(<IrisContainer padding="lg">x</IrisContainer>)
    expect((container.querySelector('[data-iris-container]') as HTMLElement).style.padding).toMatch(
      /^0(px)?\s+var\(--iris-padding-lg\)$/,
    )
  })
})

describe('@iris-ui-kit/react IrisGrid', () => {
  it('default uses auto-fit with 200px min column width', () => {
    const { container } = render(<IrisGrid>x</IrisGrid>)
    const el = container.querySelector('[data-iris-grid]') as HTMLElement
    expect(el.style.display).toBe('grid')
    expect(el.style.gridTemplateColumns).toBe('repeat(auto-fit, minmax(200px, 1fr))')
  })

  it('integer columns become repeat(N, minmax(0, 1fr))', () => {
    const { container } = render(<IrisGrid columns={3}>x</IrisGrid>)
    expect(
      (container.querySelector('[data-iris-grid]') as HTMLElement).style.gridTemplateColumns,
    ).toBe('repeat(3, minmax(0, 1fr))')
  })

  it('raw string columns pass through', () => {
    const { container } = render(<IrisGrid columns="100px 1fr 100px">x</IrisGrid>)
    expect(
      (container.querySelector('[data-iris-grid]') as HTMLElement).style.gridTemplateColumns,
    ).toBe('100px 1fr 100px')
  })

  it('auto-fill uses correct repeat syntax', () => {
    const { container } = render(
      <IrisGrid columns="auto-fill" minColWidth="160px">
        x
      </IrisGrid>,
    )
    expect(
      (container.querySelector('[data-iris-grid]') as HTMLElement).style.gridTemplateColumns,
    ).toBe('repeat(auto-fill, minmax(160px, 1fr))')
  })

  it('gap shortcut sets both row and column gap', () => {
    const { container } = render(<IrisGrid gap={16}>x</IrisGrid>)
    const el = container.querySelector('[data-iris-grid]') as HTMLElement
    expect(el.style.rowGap).toBe('16px')
    expect(el.style.columnGap).toBe('16px')
  })

  it('rowGap / columnGap override the gap shortcut', () => {
    const { container } = render(
      <IrisGrid rowGap={4} columnGap={20}>
        x
      </IrisGrid>,
    )
    const el = container.querySelector('[data-iris-grid]') as HTMLElement
    expect(el.style.rowGap).toBe('4px')
    expect(el.style.columnGap).toBe('20px')
  })

  it('inline mode uses inline-grid', () => {
    const { container } = render(<IrisGrid inline>x</IrisGrid>)
    expect((container.querySelector('[data-iris-grid]') as HTMLElement).style.display).toBe(
      'inline-grid',
    )
  })

  it('data-iris-grid-columns reflects input', () => {
    const { container } = render(<IrisGrid columns={4}>x</IrisGrid>)
    expect(
      container.querySelector('[data-iris-grid]')?.getAttribute('data-iris-grid-columns'),
    ).toBe('4')
  })
})
