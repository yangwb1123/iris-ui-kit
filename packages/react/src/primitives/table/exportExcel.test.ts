import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { exportExcel } from './exportExcel'
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
  { id: 3, name: 'Bob', age: 28 },
]

describe('@iris-ui-kit/react exportExcel', () => {
  it('serializes rows to SpreadsheetML, typing numbers and ignoring render fns', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', render: (v) => `<<${v}>>` },
      { key: 'age', title: 'Age' },
    ]
    const xml = exportExcel(rows, cols)
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>')
    expect(xml).toContain('<Data ss:Type="String">Name</Data>')
    expect(xml).toContain('<Data ss:Type="String">Charlie</Data>')
    expect(xml).toContain('<Data ss:Type="Number">25</Data>')
  })

  it('forwards headerStyle and columnWidths to the core serializer', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    const xml = exportExcel(rows, cols, { headerStyle: true, columnWidths: [12, 6] })
    expect(xml).toContain('<Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles>')
    expect(xml).toContain('<Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>')
    expect(xml).toContain('<Column ss:Width="63"/>')
    expect(xml).toContain('<Column ss:Width="31.5"/>')
  })
})
