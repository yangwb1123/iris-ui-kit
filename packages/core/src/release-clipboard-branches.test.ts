import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setClipboardHandler } from './clipboard'
import {
  applyTableMask,
  resolveTableValue,
  serializeTableRange,
  tableDisplayText,
  writeClipboardText,
  type TableClipboardColumn,
  type TableClipboardRange,
} from './table-clipboard'

const rectangle = (row: number, col: number): TableClipboardRange => ({
  start: { row: 0, col: 0 },
  end: { row, col },
})

beforeEach(() => {
  vi.stubGlobal('navigator', undefined)
  vi.stubGlobal('document', undefined)
})
afterEach(() => {
  setClipboardHandler(null)
  vi.unstubAllGlobals()
})

function legacyDocument(execCommand?: (command: string) => boolean) {
  const textarea = {
    value: '',
    style: { position: '', opacity: '' },
    setAttribute: vi.fn(),
    select: vi.fn(),
    remove: vi.fn(),
  }
  const document = {
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => textarea),
    execCommand,
  }
  return { document, textarea }
}

describe('release table clipboard branches', () => {
  it('resolves aliases and applies masks before string formatters', () => {
    const row = { secret: 'abcdefgh', alias: 'wrong', empty: null, name: 'Ada' }
    const formatter = vi.fn((value: unknown, source: typeof row) => `${value}:${source.name}`)
    const column: TableClipboardColumn<typeof row> = {
      key: 'alias',
      dataIndex: 'secret',
      title: 'Secret',
      mask: 'sensitive',
      formatter,
    }
    expect(resolveTableValue(row, column)).toBe('abcdefgh')
    expect(resolveTableValue(row, { key: 'name', title: 'Name' })).toBe('Ada')
    expect(tableDisplayText(row, column)).toBe('ab****gh:Ada')
    expect(formatter).toHaveBeenCalledWith('ab****gh', row)
    expect(tableDisplayText(row, { key: 'empty', title: 'Empty' })).toBe('')
    expect(tableDisplayText(row, { key: 'missing', title: 'Missing' })).toBe('')
    expect(tableDisplayText(row, { key: 'name', title: 'Name' })).toBe('Ada')
  })

  it('keeps the masked value when a formatter returns a non-string', () => {
    const row = { secret: 'raw' }
    const mask = vi.fn((value: unknown) => `masked(${value})`)
    const resolve = vi.fn(() => 'resolved')
    const column = { key: 'secret', title: 'Secret', mask, formatter: () => 42 }
    expect(tableDisplayText(row, column, resolve)).toBe('masked(resolved)')
    expect(resolve).toHaveBeenCalledWith(row, column)
    expect(mask).toHaveBeenCalledWith('resolved')
    expect(applyTableMask(null, { key: 'secret', title: 'Secret', mask: 'sensitive' })).toBe('')
    expect(applyTableMask(7, { key: 'secret', title: 'Secret' })).toBe(7)
  })

  it.each(['tsv', 'csv', 'html'] as const)(
    'honors formatter and exportRaw precedence in %s',
    (format) => {
      const rows = [
        { formatted: 'abcdefgh', raw: 'abcdefgh', override: 'abcdefgh', masked: 'abcdefgh' },
      ]
      const columns: TableClipboardColumn[] = [
        { key: 'formatted', title: 'Formatted', mask: 'sensitive', formatter: (v) => `[${v}]` },
        { key: 'alias', dataIndex: 'raw', title: 'Raw', mask: 'sensitive', exportRaw: true },
        {
          key: 'override',
          title: 'Override',
          mask: () => 'hidden',
          exportRaw: true,
          formatter: (v) => `<${v}>`,
        },
        { key: 'masked', title: 'Masked', mask: 'sensitive' },
      ]
      const plain = serializeTableRange(rows, columns, rectangle(0, 3), format)
      const formatted = serializeTableRange(rows, columns, rectangle(0, 3), format, true)
      if (format === 'html') {
        const head =
          '<table><thead><tr><th>Formatted</th><th>Raw</th><th>Override</th><th>Masked</th></tr></thead><tbody>'
        expect(plain).toBe(
          `${head}<tr><td>ab****gh</td><td>abcdefgh</td><td>abcdefgh</td><td>ab****gh</td></tr></tbody></table>`,
        )
        expect(formatted).toBe(
          `${head}<tr><td>[ab****gh]</td><td>abcdefgh</td><td>&lt;hidden&gt;</td><td>ab****gh</td></tr></tbody></table>`,
        )
      } else {
        const separator = format === 'csv' ? ',' : '\t'
        expect(plain).toBe(['ab****gh', 'abcdefgh', 'abcdefgh', 'ab****gh'].join(separator))
        expect(formatted).toBe(['[ab****gh]', 'abcdefgh', '<hidden>', 'ab****gh'].join(separator))
      }
      expect(rows[0]).toEqual({
        formatted: 'abcdefgh',
        raw: 'abcdefgh',
        override: 'abcdefgh',
        masked: 'abcdefgh',
      })
    },
  )

  it('quotes CSV delimiters and formula strings while retaining real negative numbers', () => {
    const rows = [{ formula: '=1+1', number: -5, quoted: 'a,"b"\nnext', empty: null }]
    const columns = Object.keys(rows[0]).map((key) => ({ key, title: key }))
    expect(serializeTableRange(rows, columns, rectangle(0, 3), 'csv')).toBe(
      '\'=1+1,-5,"a,""b""\nnext",',
    )
    expect(serializeTableRange(rows, columns, rectangle(0, 3))).toBe('\'=1+1\t-5\ta,"b"\nnext\t')
  })

  it('escapes HTML and preserves numeric alignment without exposing formulas', () => {
    const rows = [{ number: -4, empty: null, formula: '@ref', markup: '<&"', infinity: Infinity }]
    const columns = Object.keys(rows[0]).map((key) => ({ key, title: key }))
    expect(serializeTableRange(rows, columns, rectangle(0, 4), 'html')).toBe(
      '<table><thead><tr><th>number</th><th>empty</th><th>formula</th><th>markup</th><th>infinity</th></tr></thead>' +
        '<tbody><tr><td style="text-align:right">-4</td><td></td><td>&apos;@ref</td>' +
        '<td>&lt;&amp;&quot;</td><td>Infinity</td></tr></tbody></table>',
    )
  })

  it.each(['tsv', 'csv', 'html'] as const)(
    'preserves empty rows of a sparse selection in %s',
    (format) => {
      const rows = new Array<Record<string, unknown>>(2)
      rows[1] = { n: 4 }
      const output = serializeTableRange(rows, [{ key: 'n', title: 'N' }], rectangle(1, 0), format)
      expect(output).toBe(
        format === 'html'
          ? '<table><thead><tr><th>N</th></tr></thead><tbody><tr><td></td></tr><tr><td style="text-align:right">4</td></tr></tbody></table>'
          : '\n4',
      )
    },
  )

  it('clamps reversed fractional ranges and defaults unknown formats to headerless TSV', () => {
    const rows = [
      { name: 'Ada', age: 30 },
      { name: 'Lin', age: 40 },
    ]
    const columns = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    expect(
      serializeTableRange(
        rows,
        columns,
        {
          start: { row: 99.9, col: 99.9 },
          end: { row: -2.8, col: -1.7 },
        },
        'unsupported',
      ),
    ).toBe('Ada\t30\nLin\t40')
    const resolve = vi.fn(() => 'must not read')
    expect(
      serializeTableRange(
        rows,
        columns,
        {
          start: { row: NaN, col: 0 },
          end: { row: 1, col: 1 },
        },
        'csv',
        false,
        resolve,
      ),
    ).toBe('')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('uses a host handler before browser or legacy clipboard access', async () => {
    const handler = vi.fn(async () => true)
    const writeText = vi.fn()
    const legacy = legacyDocument(() => true)
    setClipboardHandler(handler)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('document', legacy.document)
    await expect(writeClipboardText('host text')).resolves.toBe(true)
    expect(handler).toHaveBeenCalledWith('host text')
    expect(writeText).not.toHaveBeenCalled()
    expect(legacy.document.createElement).not.toHaveBeenCalled()
  })

  it('falls through a declining host handler to the browser clipboard', async () => {
    setClipboardHandler(async () => false)
    const writeText = vi.fn(async () => undefined)
    const legacy = legacyDocument(() => true)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('document', legacy.document)
    await expect(writeClipboardText('browser text')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('browser text')
    expect(legacy.document.createElement).not.toHaveBeenCalled()
  })

  it('falls back after browser denial and removes the temporary textarea', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const execCommand = vi.fn(() => true)
    const { document, textarea } = legacyDocument(execCommand)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('document', document)
    await expect(writeClipboardText('legacy\ntext')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('legacy\ntext')
    expect(document.createElement).toHaveBeenCalledWith('textarea')
    expect(textarea.value).toBe('legacy\ntext')
    expect(textarea.setAttribute).toHaveBeenCalledWith('readonly', '')
    expect(textarea.style).toEqual({ position: 'fixed', opacity: '0' })
    expect(document.body.appendChild).toHaveBeenCalledWith(textarea)
    expect(textarea.select.mock.invocationCallOrder[0]).toBeLessThan(
      execCommand.mock.invocationCallOrder[0],
    )
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(textarea.remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      execCommand.mock.invocationCallOrder[0],
    )
  })

  it.each(['unavailable', 'declined', 'throwing'] as const)(
    'cleans up an %s legacy copy attempt',
    async (kind) => {
      const execCommand =
        kind === 'unavailable'
          ? undefined
          : vi.fn(() => {
              if (kind === 'throwing') throw new Error('legacy denied')
              return false
            })
      const { document, textarea } = legacyDocument(execCommand)
      vi.stubGlobal('navigator', { clipboard: {} })
      vi.stubGlobal('document', document)
      await expect(writeClipboardText('optional copy')).resolves.toBe(false)
      expect(textarea.value).toBe('optional copy')
      expect(textarea.remove).toHaveBeenCalledOnce()
    },
  )

  it.each([undefined, { body: undefined }])(
    'returns false without a document body',
    async (document) => {
      vi.stubGlobal('document', document)
      await expect(writeClipboardText('SSR text')).resolves.toBe(false)
    },
  )

  it('propagates host handler rejection before touching browser clipboard', async () => {
    const failure = new Error('native host failed')
    setClipboardHandler(async () => {
      throw failure
    })
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(writeClipboardText('host failure')).rejects.toBe(failure)
    expect(writeText).not.toHaveBeenCalled()
  })
})
