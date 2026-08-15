import { describe, expect, it } from 'vitest'
import { exportCsv } from './exportCsv'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  v: unknown
}

const cols: IrisTableColumn<Row>[] = [{ key: 'v', title: 'V', dataIndex: 'v' }]

describe('exportCsv — formula-injection neutralization (OWASP)', () => {
  it('prefixes cells that begin with = + - @ with a single quote', () => {
    expect(exportCsv([{ v: '=HYPERLINK("http://evil","x")' }], cols)).toBe(
      `V\n"'=HYPERLINK(""http://evil"",""x"")"`,
    )
    expect(exportCsv([{ v: '+cmd' }], cols)).toBe("V\n'+cmd")
    expect(exportCsv([{ v: '-2+3' }], cols)).toBe("V\n'-2+3")
    expect(exportCsv([{ v: '@SUM(A1)' }], cols)).toBe("V\n'@SUM(A1)")
  })

  it('neutralizes a tab-led cell that would shift the lead char', () => {
    expect(exportCsv([{ v: '\t=1+1' }], cols)).toBe("V\n'\t=1+1")
  })

  it('does NOT mangle real numbers, including negatives', () => {
    expect(exportCsv([{ v: -5 }], cols)).toBe('V\n-5')
    expect(exportCsv([{ v: 42 }], cols)).toBe('V\n42')
  })

  it('leaves ordinary text untouched', () => {
    expect(exportCsv([{ v: 'Ann' }], cols)).toBe('V\nAnn')
  })
})

describe('exportCsv — batch AY column mask', () => {
  it('masks a masked column by default; exportRaw exports the raw value', () => {
    const masked: IrisTableColumn<Row>[] = [
      { key: 'v', title: 'V', dataIndex: 'v', mask: 'sensitive' },
    ]
    expect(exportCsv([{ v: '13812345678' }], masked)).toBe('V\n138****5678')
    const raw: IrisTableColumn<Row>[] = [
      { key: 'v', title: 'V', dataIndex: 'v', mask: 'sensitive', exportRaw: true },
    ]
    expect(exportCsv([{ v: '13812345678' }], raw)).toBe('V\n13812345678')
  })

  it('a non-string dataIndex does NOT drop the mask (shadow write key matches the serializer read)', () => {
    // Regression (batch AY review, LOW): with a numeric dataIndex the old
    // `row[dataIndex ?? key]` shadow write landed on a key the serializer
    // never reads (numeric dataIndex is dropped by the column spec), so the
    // masked value was silently lost and `toCsv` read the RAW value.
    const numIndex: IrisTableColumn<Row>[] = [
      { key: 'v', title: 'V', dataIndex: 3 as unknown as string, mask: 'sensitive' },
    ]
    expect(exportCsv([{ v: '13812345678' }], numIndex)).toBe('V\n138****5678')
  })

  it('masking through a string dataIndex different from the key applies on the resolved field', () => {
    const viaDataIndex: IrisTableColumn<Row>[] = [
      { key: 'v', title: 'V', dataIndex: 'mobile', mask: 'sensitive' },
    ]
    expect(exportCsv([{ mobile: '13900001111', v: 'unused' }], viaDataIndex)).toBe('V\n139****1111')
  })
})
