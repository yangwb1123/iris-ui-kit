import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import { TABLE_ROW_CSS as SHARED_TABLE_ROW_CSS } from './styles'
import { IrisI18nProvider } from '../../i18n'
import type { IrisTableDensity } from './props'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function toggle(): HTMLElement | null {
  return document.querySelector('[data-iris-density-toggle]')
}

function toolbar(): HTMLElement | null {
  return document.querySelector('[data-iris-table-toolbar]')
}

function firstCell(): HTMLElement {
  return document.querySelector('[role="cell"]') as HTMLElement
}

/** The injected table stylesheet (idempotent single style tag). */
function sheet(): HTMLElement | null {
  return document.getElementById('iris-table-row-styles')
}

// ── Batch CP density tiers + toolbar toggle (iris 独有 — vxe has no
//    density concept: no vxe tableProps option to mirror) ────────────────
describe('IrisTable density (batch CP)', () => {
  it('default: comfortable is emitted, no toggle button, no toolbar', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(root().getAttribute('data-density')).toBe('comfortable')
    // No toolbar exists without a toolbar prop or a toggle.
    expect(toolbar()).toBeNull()
    expect(toggle()).toBeNull()
    expect(container.querySelector('[data-iris-density-toggle]')).toBeNull()
  })

  it('tier attrs: compact / cozy ride the root data-density attribute', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" density="compact" />,
    )
    expect(root().getAttribute('data-density')).toBe('compact')
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" density="cozy" />)
    expect(root().getAttribute('data-density')).toBe('cozy')
  })

  it('density stacks on top of size (both attrs coexist, density wins in CSS order)', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" size="small" density="compact" />,
    )
    expect(root().getAttribute('data-size')).toBe('small')
    expect(root().getAttribute('data-density')).toBe('compact')
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" size="mini" density="cozy" />)
    expect(root().getAttribute('data-size')).toBe('mini')
    expect(root().getAttribute('data-density')).toBe('cozy')
  })

  it('invalid density fails closed to comfortable', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        density={'bogus' as unknown as IrisTableDensity}
      />,
    )
    expect(root().getAttribute('data-density')).toBe('comfortable')
  })

  it('densityToggle alone opens the toolbar with the toggle button (gate admission)', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" densityToggle />)
    expect(toolbar()).not.toBeNull()
    expect(toggle()).not.toBeNull()
    expect(container.querySelector('[data-iris-table-toolbar]')).not.toBeNull()
  })

  it("layouts toolbar: 'hidden' suppresses the toggle with the toolbar", () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        densityToggle
        layouts={{ toolbar: 'hidden' }}
      />,
    )
    expect(toolbar()).toBeNull()
    expect(toggle()).toBeNull()
  })

  it('cycle behavior: three clicks walk comfortable → compact → cozy → comfortable', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" densityToggle />)
    expect(root().getAttribute('data-density')).toBe('comfortable')
    fireEvent.click(toggle()!)
    expect(root().getAttribute('data-density')).toBe('compact')
    fireEvent.click(toggle()!)
    expect(root().getAttribute('data-density')).toBe('cozy')
    fireEvent.click(toggle()!)
    expect(root().getAttribute('data-density')).toBe('comfortable')
  })

  it('seed-once: the toggle starts at comfortable with the button in sync', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" densityToggle />)
    expect(toggle()!.getAttribute('data-iris-density')).toBe('comfortable')
    expect(toggle()!.textContent).toBe('Comfortable')
    expect(toggle()!.getAttribute('aria-label')).toBe('Density: Comfortable')
    fireEvent.click(toggle()!)
    expect(toggle()!.getAttribute('data-iris-density')).toBe('compact')
    expect(toggle()!.textContent).toBe('Compact')
    expect(toggle()!.getAttribute('aria-label')).toBe('Density: Compact')
  })

  it('toggle state wins over the density prop while shown', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" density="cozy" densityToggle />)
    // Button state (not the prop) drives the effective tier.
    expect(root().getAttribute('data-density')).toBe('comfortable')
    fireEvent.click(toggle()!)
    expect(root().getAttribute('data-density')).toBe('compact')
    expect(toggle()!.textContent).toBe('Compact')
  })

  it('prop tier is honored when the toggle is off (no button rendered)', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" density="compact" />,
    )
    expect(root().getAttribute('data-density')).toBe('compact')
    expect(toggle()).toBeNull()
    expect(container.querySelector('[data-iris-table-toolbar]')).toBeNull()
  })

  it('zh locale renders the localized tier label on the toggle button', () => {
    render(
      <IrisI18nProvider
        messages={{
          'table.density': '密度',
          'table.density.comfortable': '宽松',
          'table.density.compact': '紧凑',
          'table.density.cozy': '密集',
        }}
      >
        <IrisTable columns={cols} data={rows} rowKey="id" densityToggle />
      </IrisI18nProvider>,
    )
    expect(toggle()!.textContent).toBe('宽松')
    expect(toggle()!.getAttribute('aria-label')).toBe('密度: 宽松')
    fireEvent.click(toggle()!)
    expect(toggle()!.textContent).toBe('紧凑')
  })

  it('structural lock: tiers are CSS-only (sheet rules after size presets, cells read the var chain)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" density="cozy" />)
    const text = sheet()!.textContent ?? ''
    // Density rules exist in the INJECTED react sheet…
    expect(text).toContain('[data-iris-table][data-density="compact"]')
    expect(text).toContain('--iris-cell-pad-y: 6px')
    expect(text).toContain('[data-iris-table][data-density="cozy"]')
    expect(text).toContain('--iris-cell-pad-y: 4px')
    // …and in the SHARED sheet (styles.ts) they come AFTER the size presets
    // (same specificity, later wins — density stacks on top of size).
    expect(SHARED_TABLE_ROW_CSS).toContain('[data-iris-table][data-density="compact"]')
    expect(
      SHARED_TABLE_ROW_CSS.indexOf('[data-iris-table][data-density="compact"]'),
    ).toBeGreaterThan(SHARED_TABLE_ROW_CSS.indexOf('[data-iris-table][data-size="mini"]'))
    // Zero inline density: the root carries no --iris-cell-pad-y and cells
    // still read the shared var chain (CSS-only, no inline padding override).
    expect(root().style.getPropertyValue('--iris-cell-pad-y')).toBe('')
    expect(firstCell().style.padding).toBe('var(--iris-cell-pad, var(--iris-cell-pad-y, 8px) 12px)')
  })
})
