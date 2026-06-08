import { describe, expect, it } from 'vitest'
import { toSpreadsheetXml, toCsv, type TableExportColumn } from './table-export'

interface Row extends Record<string, unknown> {
  name: string
  age: number
  city?: string
}

const columns: TableExportColumn[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const rows: Row[] = [
  { name: 'Ann', age: 30 },
  { name: 'Bob', age: 25 },
]

describe('toSpreadsheetXml', () => {
  it('emits a SpreadsheetML workbook with the mso-application PI', () => {
    const xml = toSpreadsheetXml(rows, columns)
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>')
    expect(xml).toContain('urn:schemas-microsoft-com:office:spreadsheet')
    expect(xml).toContain('<Worksheet ss:Name="Sheet1">')
  })

  it('writes a header row from column titles', () => {
    const xml = toSpreadsheetXml(rows, columns)
    expect(xml).toContain('<Data ss:Type="String">Name</Data>')
    expect(xml).toContain('<Data ss:Type="String">Age</Data>')
  })

  it('types numeric cells as Number and text as String', () => {
    const xml = toSpreadsheetXml(rows, columns)
    expect(xml).toContain('<Data ss:Type="String">Ann</Data>')
    expect(xml).toContain('<Data ss:Type="Number">30</Data>')
  })

  it('reads values via dataIndex when provided', () => {
    const cols: TableExportColumn[] = [{ key: 'c', title: 'City', dataIndex: 'city' }]
    const xml = toSpreadsheetXml([{ city: 'Paris' }], cols)
    expect(xml).toContain('<Data ss:Type="String">Paris</Data>')
  })

  it('escapes XML-significant characters', () => {
    const xml = toSpreadsheetXml([{ name: 'A & <b> "q"', age: 1 }], columns)
    expect(xml).toContain('A &amp; &lt;b&gt; &quot;q&quot;')
    expect(xml).not.toContain('<b>')
  })

  it('renders empty cells for null/undefined', () => {
    const xml = toSpreadsheetXml([{ name: null, age: undefined } as unknown as Row], columns)
    expect(xml).toContain('<Cell><Data ss:Type="String"></Data></Cell>')
  })

  it('honors a custom sheet name (escaped)', () => {
    expect(toSpreadsheetXml(rows, columns, { sheetName: 'Q1 & Q2' })).toContain(
      '<Worksheet ss:Name="Q1 &amp; Q2">',
    )
  })

  it('header only when there are no rows', () => {
    const xml = toSpreadsheetXml([], columns)
    expect(xml).toContain('<Data ss:Type="String">Name</Data>')
    // Exactly one <Row> (the header).
    expect(xml.match(/<Row>/g)?.length).toBe(1)
  })

  it('rows produce one <Row> each plus the header', () => {
    const xml = toSpreadsheetXml(rows, columns)
    expect(xml.match(/<Row>/g)?.length).toBe(3)
  })
})

describe('toCsv', () => {
  it('emits a header row then one row per record', () => {
    const csv = toCsv(rows, columns)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Name,Age')
    expect(lines).toHaveLength(rows.length + 1)
  })

  it('reads via dataIndex when provided', () => {
    const cols: TableExportColumn[] = [{ key: 'c', title: 'City', dataIndex: 'city' }]
    expect(toCsv([{ city: 'NYC' }], cols)).toBe('City\nNYC')
  })

  it('quotes fields containing comma, quote, or newline (RFC 4180)', () => {
    const cols: TableExportColumn[] = [{ key: 'v', title: 'V' }]
    expect(toCsv([{ v: 'a,b' }], cols)).toBe('V\n"a,b"')
    expect(toCsv([{ v: 'a"b' }], cols)).toBe('V\n"a""b"')
    expect(toCsv([{ v: 'a\nb' }], cols)).toBe('V\n"a\nb"')
  })

  it('header only when there are no rows', () => {
    expect(toCsv([], columns)).toBe('Name,Age')
  })
})
