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
