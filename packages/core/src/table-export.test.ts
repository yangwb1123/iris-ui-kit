import { describe, expect, it } from 'vitest'
import {
  toSpreadsheetXml,
  toCsv,
  toJson,
  toHtml,
  parseCsv,
  type TableExportColumn,
} from './table-export'

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

  it('emits no styles/widths by default (byte-compat lock)', () => {
    const xml = toSpreadsheetXml(rows, columns)
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<?mso-application progid="Excel.Sheet"?>\n' +
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
        ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
        '<Worksheet ss:Name="Sheet1"><Table>' +
        '<Row><Cell><Data ss:Type="String">Name</Data></Cell>' +
        '<Cell><Data ss:Type="String">Age</Data></Cell></Row>' +
        '<Row><Cell><Data ss:Type="String">Ann</Data></Cell>' +
        '<Cell><Data ss:Type="Number">30</Data></Cell></Row>' +
        '<Row><Cell><Data ss:Type="String">Bob</Data></Cell>' +
        '<Cell><Data ss:Type="Number">25</Data></Cell></Row>' +
        '</Table></Worksheet></Workbook>',
    )
    expect(xml).not.toContain('<Styles>')
    expect(xml).not.toContain('StyleID')
    expect(xml).not.toContain('<Column')
  })

  it('headerStyle emits a bold Font style applied to header cells only', () => {
    const xml = toSpreadsheetXml(rows, columns, { headerStyle: true })
    // Styles block sits before the Worksheet and carries the bold font.
    expect(xml).toContain(
      '<Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles><Worksheet',
    )
    // Header cells reference the style; body cells stay unstyled.
    expect(xml).toContain('<Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>')
    expect(xml).toContain('<Cell ss:StyleID="Header"><Data ss:Type="String">Age</Data></Cell>')
    expect(xml).not.toContain('<Cell ss:StyleID="Header"><Data ss:Type="String">Ann</Data>')
    expect(xml).toContain('<Cell><Data ss:Type="String">Ann</Data></Cell>')
  })

  it('columnWidths writes <Column> widths in points (5.25pt/char)', () => {
    const xml = toSpreadsheetXml(rows, columns, { columnWidths: [10, 5] })
    expect(xml).toContain('<Column ss:Width="52.5"/>')
    expect(xml).toContain('<Column ss:Width="26.25"/>')
    // Widths are emitted before the header row.
    expect(xml).toContain('<Table><Column ss:Width="52.5"/><Column ss:Width="26.25"/><Row>')
  })

  it('columnWidths are clamped to the column count', () => {
    const xml = toSpreadsheetXml(rows, columns, { columnWidths: [10, 20, 30] })
    expect(xml.match(/<Column/g)?.length).toBe(2)
    expect(xml).not.toContain('<Column ss:Width="157.5"/>')
  })

  it('columnWidths skip non-finite and non-positive entries', () => {
    const xml = toSpreadsheetXml(rows, columns, {
      columnWidths: [10, 0, -3, Number.NaN, Number.POSITIVE_INFINITY],
    })
    expect(xml.match(/<Column/g)?.length).toBe(1)
    expect(xml).toContain('<Column ss:Width="52.5"/>')
  })

  it('combines headerStyle with columnWidths', () => {
    const xml = toSpreadsheetXml(rows, columns, { headerStyle: true, columnWidths: [8] })
    expect(xml).toContain('<Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles>')
    expect(xml).toContain('<Table><Column ss:Width="42"/>')
    expect(xml).toContain('<Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>')
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

  describe('formula-injection neutralization (OWASP)', () => {
    const cols: TableExportColumn[] = [{ key: 'v', title: 'V' }]

    it('prefixes cells that begin with = + - @ with a single quote', () => {
      expect(toCsv([{ v: '=HYPERLINK("http://evil","x")' }], cols)).toBe(
        `V\n"'=HYPERLINK(""http://evil"",""x"")"`,
      )
      expect(toCsv([{ v: '+cmd' }], cols)).toBe("V\n'+cmd")
      expect(toCsv([{ v: '-2+3' }], cols)).toBe("V\n'-2+3")
      expect(toCsv([{ v: '@SUM(A1)' }], cols)).toBe("V\n'@SUM(A1)")
    })

    it('neutralizes tab-led cells that would shift the lead char', () => {
      expect(toCsv([{ v: '\t=1+1' }], cols)).toBe("V\n'\t=1+1")
    })

    it('does NOT mangle real numbers (including negatives)', () => {
      expect(toCsv([{ v: -5 }], cols)).toBe('V\n-5')
      expect(toCsv([{ v: 42 }], cols)).toBe('V\n42')
    })

    it('leaves ordinary text untouched', () => {
      expect(toCsv([{ v: 'Ann' }], cols)).toBe('V\nAnn')
    })

    it('neutralizes formula leads in SpreadsheetML String cells only', () => {
      const xml = toSpreadsheetXml([{ v: '=1+1' }], cols)
      // The prefix quote is XML-escaped; Excel decodes &apos; back to ' → literal text.
      expect(xml).toContain(`<Data ss:Type="String">&apos;=1+1</Data>`)
      const num = toSpreadsheetXml([{ v: -5 }], cols)
      expect(num).toContain('<Data ss:Type="Number">-5</Data>')
    })
  })
})

describe('toJson', () => {
  it('serializes rows keyed by column key, reading dataIndex', () => {
    const cols: TableExportColumn[] = [
      { key: 'name', title: 'Name' },
      { key: 'years', title: 'Age', dataIndex: 'age' },
    ]
    expect(JSON.parse(toJson(rows, cols))).toEqual([
      { name: 'Ann', years: 30 },
      { name: 'Bob', years: 25 },
    ])
  })

  it('honors pretty: false (compact)', () => {
    expect(toJson(rows, columns, { pretty: false })).not.toContain('\n')
  })
})

describe('toHtml', () => {
  it('emits a table with escaped cells + right-aligned numbers', () => {
    const html = toHtml([{ name: 'A & <b>', age: 7 }], columns)
    expect(html.startsWith('<table>')).toBe(true)
    expect(html).toContain('<th>Name</th>')
    expect(html).toContain('A &amp; &lt;b&gt;')
    expect(html).toContain('<td style="text-align:right">7</td>')
  })

  it('adds a caption when given', () => {
    expect(toHtml(rows, columns, { caption: 'People' })).toContain('<caption>People</caption>')
  })
})

describe('parseCsv (import parity)', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('handles quoted fields with commas and quotes', () => {
    expect(parseCsv('"x,y","say ""hi"""')).toEqual([['x,y', 'say "hi"']])
  })

  it('round-trips toCsv output', () => {
    const csv = toCsv(
      [
        { a: 1, b: 'x,y' },
        { a: 2, b: 'z' },
      ],
      [
        { key: 'a', title: 'a' },
        { key: 'b', title: 'b' },
      ],
    )
    const parsed = parseCsv(csv)
    expect(parsed[0]).toEqual(['a', 'b'])
    expect(parsed[1]).toEqual(['1', 'x,y'])
  })
})
