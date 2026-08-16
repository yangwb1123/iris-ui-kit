import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import { IrisI18nProvider } from '../../../i18n'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  city: string
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, city: 'Rome' },
  { id: 2, name: 'Alice', age: 32, city: 'Oslo' },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
  { key: 'city', title: 'City' },
]

function trigger(): HTMLElement | null {
  return document.querySelector('[data-iris-shortcut-hints-trigger]')
}

function panel(): HTMLElement | null {
  return document.querySelector('[data-iris-shortcut-hints-panel]')
}

function rowsShown(): Array<{ action: string; keys: string; label: string }> {
  return [...document.querySelectorAll('[data-iris-shortcut-row]')].map((row) => ({
    action: row.getAttribute('data-iris-shortcut-action') ?? '',
    keys: row.querySelector('[data-iris-shortcut-keys]')?.textContent ?? '',
    label: row.childNodes[0]?.textContent ?? '',
  }))
}

function openPanel(): HTMLElement {
  fireEvent.click(trigger()!)
  const p = panel()
  expect(p).not.toBeNull()
  return p as HTMLElement
}

// The canonical 8-action order + exact default key display strings.
const DEFAULT_KEYS: Array<[string, string]> = [
  ['edit', 'F2'],
  ['clear', 'Delete / Backspace'],
  ['undo', 'Ctrl+Z'],
  ['redo', 'Ctrl+Y / Ctrl+Shift+Z'],
  ['copy', 'Ctrl+C'],
  ['paste', 'Ctrl+V'],
  ['fill', 'Ctrl+D'],
  ['query', 'Ctrl+K'],
]

describe('IrisTable shortcutHints — 快捷键提示 (keyboard shortcut reference)', () => {
  it('fail-closed: no trigger and no panel without the prop', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(trigger()).toBeNull()
    expect(panel()).toBeNull()
  })

  it('the prop alone admits the toolbar gate and renders the ? trigger', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" shortcutHints />)
    expect(document.querySelector('[data-iris-table-toolbar]')).not.toBeNull()
    expect(trigger()).not.toBeNull()
    expect(trigger()!.textContent).toBe('?')
    expect(trigger()!.getAttribute('aria-label')).toBe('Keyboard shortcuts')
    expect(trigger()!.getAttribute('title')).toBe('Keyboard shortcuts')
  })

  it('open lists all 8 actions in canonical order with the exact default keys', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" shortcutHints />)
    openPanel()
    const list = rowsShown()
    expect(list.map((r) => [r.action, r.keys])).toEqual(DEFAULT_KEYS)
    // Labels resolve from the default messages (en).
    expect(list[0]!.label).toBe('Edit cell')
    expect(list[7]!.label).toBe('Filter query')
  })

  it('an override reflects in the panel: wholesale replacement drops the alias', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        shortcutHints
        keymap={{ clear: 'Delete' }}
      />,
    )
    openPanel()
    const list = rowsShown()
    // clear = the override ONLY (the Backspace alias is gone).
    expect(list.find((r) => r.action === 'clear')!.keys).toBe('Delete')
    // Every other action keeps its default.
    for (const [action, keys] of DEFAULT_KEYS) {
      if (action !== 'clear') expect(list.find((r) => r.action === action)!.keys).toBe(keys)
    }
  })

  it('a modifier remap shows in the exact display-cased form', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        shortcutHints
        keymap={{ edit: 'Space', undo: 'Alt+Z', query: 'Ctrl+J' }}
      />,
    )
    openPanel()
    const list = rowsShown()
    expect(list.find((r) => r.action === 'edit')!.keys).toBe('Space')
    expect(list.find((r) => r.action === 'undo')!.keys).toBe('Alt+Z')
    expect(list.find((r) => r.action === 'query')!.keys).toBe('Ctrl+J')
  })

  it('invalid overrides fail closed: the action keeps its default binding', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        shortcutHints
        keymap={{ edit: '', clear: 'Meta', redo: 'Ctrl+' }}
      />,
    )
    openPanel()
    const list = rowsShown()
    expect(list.find((r) => r.action === 'edit')!.keys).toBe('F2')
    expect(list.find((r) => r.action === 'clear')!.keys).toBe('Delete / Backspace')
    expect(list.find((r) => r.action === 'redo')!.keys).toBe('Ctrl+Y / Ctrl+Shift+Z')
  })

  it('Esc closes the panel', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" shortcutHints />)
    openPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel()).toBeNull()
  })

  it('outside pointer-down closes; a press on the trigger toggles instead', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" shortcutHints />)
    openPanel()
    fireEvent.pointerDown(document.body)
    expect(panel()).toBeNull()
    fireEvent.click(trigger()!)
    expect(panel()).not.toBeNull()
    // The trigger is exempt from the outside-close — a second press toggles.
    fireEvent.click(trigger()!)
    expect(panel()).toBeNull()
  })

  it('zh locale renders the localized header and action labels', () => {
    render(
      <IrisI18nProvider
        messages={{
          'table.shortcuts': '键盘快捷键',
          'table.shortcuts.edit': '编辑单元格',
          'table.shortcuts.clear': '清空单元格',
          'table.shortcuts.undo': '撤销',
          'table.shortcuts.redo': '重做',
          'table.shortcuts.copy': '复制',
          'table.shortcuts.paste': '粘贴',
          'table.shortcuts.fill': '向下填充',
          'table.shortcuts.query': '筛选查询',
        }}
      >
        <IrisTable columns={cols} data={rows} rowKey="id" shortcutHints />
      </IrisI18nProvider>,
    )
    fireEvent.click(trigger()!)
    const p = panel()
    expect(p).not.toBeNull()
    expect(p!.getAttribute('aria-label')).toBe('键盘快捷键')
    expect(p!.querySelector('[data-iris-shortcut-hints-title]')!.textContent).toContain(
      '键盘快捷键',
    )
    const list = rowsShown()
    expect(list.map((r) => r.label)).toEqual([
      '编辑单元格',
      '清空单元格',
      '撤销',
      '重做',
      '复制',
      '粘贴',
      '向下填充',
      '筛选查询',
    ])
    // The KEY display is locale-independent.
    expect(list.map((r) => [r.action, r.keys])).toEqual(DEFAULT_KEYS)
  })

  it('live remap: a keymap change while open updates the listed keys in place', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" shortcutHints keymap={{ edit: 'F3' }} />,
    )
    openPanel()
    expect(rowsShown().find((r) => r.action === 'edit')!.keys).toBe('F3')
    rerender(
      <IrisTable columns={cols} data={rows} rowKey="id" shortcutHints keymap={{ edit: 'F4' }} />,
    )
    expect(rowsShown().find((r) => r.action === 'edit')!.keys).toBe('F4')
    expect(panel()).not.toBeNull() // stayed open, no remount
  })

  it('the panel is a read-only reference: no rebind controls, 8 rows', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" shortcutHints />)
    const p = openPanel()
    expect(p.querySelector('[data-iris-shortcut-hints-list]')).not.toBeNull()
    expect(rowsShown()).toHaveLength(8)
    expect(p.querySelectorAll('input, select, textarea, button')).toHaveLength(0)
  })
})
