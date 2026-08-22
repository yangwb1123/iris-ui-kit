import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'
import { parseFnrQuery, replaceAllOccurrences } from '../clipboard-display-helpers'

/**
 * Batch DX (iris 独有 — raw vxe fnr search is a plain string): fnr 查找支持
 * regexp — a `/pattern/` or `/pattern/flags` query auto-parses to a RegExp
 * (fail-closed to literal substring while typing, never throws), flags
 * canonicalized to always include `g` (“replace 全匹配”), case-sensitive by
 * default (`/i` opt-in). `replaceAllOccurrences` gains an optional regex
 * param → real `String.replace` semantics (`$1`/`$&` expand); absent →
 * byte-identical literal path.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

// Ages include a single digit so `/[0-9]{2}/` discriminates: 25/32 match, 4 does not.
const rows: Row[] = [
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'alice', age: 32 },
  { id: 3, name: 'Bob', age: 4 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

/** Body-cell lookup by leaf column index (works without `cellRange`). */
function cellAt(row: number, col: number): HTMLElement {
  const rows = Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])'),
  )
  return rows[row]!.querySelectorAll('[data-iris-table-cell]')[col] as HTMLElement
}

function openFnr(): HTMLInputElement {
  fireEvent.keyDown(root(), { key: 'f', ctrlKey: true })
  const find = document.querySelector('[data-iris-fnr-find]') as HTMLInputElement
  expect(find).not.toBeNull()
  return find
}

function queryFnr(query: string): void {
  fireEvent.change(document.querySelector('[data-iris-fnr-find]')!, {
    target: { value: query },
  })
}

function setReplace(replacement: string): void {
  fireEvent.change(document.querySelector('[data-iris-fnr-replace]')!, {
    target: { value: replacement },
  })
}

function fnrMatches(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-fnr-match="true"]'))
}

// ── parser unit: recognition + fail-closed ────────────────────────────────
describe('parseFnrQuery', () => {
  it('recognizes /pattern/ with the g flag forced on', () => {
    const re = parseFnrQuery('/lice/')
    expect(re).toBeInstanceOf(RegExp)
    expect(re!.flags).toBe('g')
    expect(re!.test('Alice')).toBe(true)
    expect(re!.test('Bob')).toBe(false)
  })

  it('/pattern/i opts into case-insensitivity; default is case-sensitive', () => {
    expect(parseFnrQuery('/alice/')!.test('Alice')).toBe(false)
    expect(parseFnrQuery('/alice/i')!.test('Alice')).toBe(true)
    expect(parseFnrQuery('/alice/i')!.flags).toContain('i')
  })

  it('fails closed to null: plain text, unterminated, empty body, invalid, bad flags', () => {
    for (const q of ['alice', '/unclosed', '//', '/[/', '/ali/x', '/ali/I', 'a/b', '']) {
      expect(parseFnrQuery(q), q).toBeNull()
    }
  })

  it('handles escaped slashes and resets lastIndex (stateless finds)', () => {
    const re = parseFnrQuery('/a\\/b/')!
    expect(re.test('a/b')).toBe(true)
    // The fnr find path resets lastIndex before each .test().
    re.lastIndex = 0
    expect(re.test('a/b')).toBe(true)
    re.lastIndex = 0
    expect(re.test('a/b')).toBe(true)
  })
})

// ── replace unit: literal parity + regexp semantics ───────────────────────
describe('replaceAllOccurrences', () => {
  it('literal path keeps `$` literal (byte-identical regression anchor)', () => {
    expect(replaceAllOccurrences('abc', 'b', '$&x')).toBe('a$&xc')
    expect(replaceAllOccurrences('AlIcE x alice', 'alice', 'X')).toBe('X x X')
  })

  it('absent/null regex falls back to the literal path', () => {
    expect(replaceAllOccurrences('abc', 'b', '$1')).toBe('a$1c')
    expect(replaceAllOccurrences('abc', 'b', '$1', null)).toBe('a$1c')
  })

  it('regexp path expands $1 captures and $& whole matches', () => {
    const q = '/(\\d+)-(\\d+)/'
    expect(replaceAllOccurrences('01-23', q, '$2-$1', parseFnrQuery(q))).toBe('23-01')
    const digits = '/\\d+/'
    expect(replaceAllOccurrences('a1b2', digits, '<$&>', parseFnrQuery(digits))).toBe('a<1>b<2>')
  })
})

// ── DOM find: regexp semantics drive the highlight set ────────────────────
describe('IrisTable fnr regexp find', () => {
  it('the . wildcard proves regexp semantics: /l.ce/ matches both name cells', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('/l.ce/')
    expect(fnrMatches().length).toBe(2) // literal 'l.ce' would match 0
    expect(document.querySelector('[data-iris-fnr-count]')?.textContent).toBe('1/2')
  })

  it('case-sensitive by default; /alice/i flips to both case variants', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('/alice/')
    expect(fnrMatches().length).toBe(1)
    expect(document.querySelector('[data-iris-fnr-active="true"]')).toBe(cellAt(1, 0))
    queryFnr('/alice/i')
    expect(fnrMatches().length).toBe(2)
  })

  it('character classes drive matches: /[0-9]{2}/ hits the two-digit ages only', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('/[0-9]{2}/')
    expect(fnrMatches().length).toBe(2)
    expect(document.querySelector('[data-iris-fnr-active="true"]')).toBe(cellAt(0, 1))
  })

  it('anchors work: /^B/ matches only Bob\u2019s name', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('/^B/')
    expect(fnrMatches().length).toBe(1)
    expect(document.querySelector('[data-iris-fnr-active="true"]')).toBe(cellAt(2, 0))
  })
})

// ── DOM replace: regexp replaces with captures, one commit ────────────────
describe('IrisTable fnr regexp replace', () => {
  it('replace (active) expands captures through commitRowList', () => {
    const onDataChange = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr onDataChange={onDataChange} />)
    openFnr()
    queryFnr('/l(i)ce/')
    expect(fnrMatches().length).toBe(2)
    setReplace('[$1]')
    fireEvent.click(document.querySelector('[data-iris-fnr-replace-btn]')!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'A[i]' })
    expect(next[1]).toMatchObject({ id: 2, name: 'alice' }) // untouched
    // Matches recompute: 'A[i]' dropped, lowercase 'alice' still matches.
    expect(fnrMatches().length).toBe(1)
  })

  it('replace-all rewrites every regexp match in one commit', () => {
    const onDataChange = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr onDataChange={onDataChange} />)
    openFnr()
    queryFnr('/l(i)ce/')
    setReplace('[$1]')
    fireEvent.click(document.querySelector('[data-iris-fnr-replace-all]')!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'A[i]' })
    expect(next[1]).toMatchObject({ id: 2, name: 'a[i]' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 4 })
    expect(fnrMatches().length).toBe(0)
  })
})

// ── typing-state: fail-closed flips when the closing slash lands ──────────
describe('IrisTable fnr regexp fail-closed while typing', () => {
  it('/alic is literal (no match) until the closing / flips it to regexp', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('/alic')
    expect(fnrMatches().length).toBe(0)
    queryFnr('/alic/')
    expect(fnrMatches().length).toBe(1) // 'alic' inside lowercase 'alice'
  })

  it('an invalid pattern never throws — it stays on the literal path', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('/[/')
    expect(fnrMatches().length).toBe(0)
    // Parser is a pure function fed the same input — no crash while typing.
    expect(parseFnrQuery('/[/')).toBeNull()
  })
})

// ── regressions: literal parity, locked cells, empty query ────────────────
describe('IrisTable fnr regexp regressions', () => {
  it('plain literal queries keep case-insensitive substring parity', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('AL')
    expect(fnrMatches().length).toBe(2) // Alice + alice, exactly as before batch DX
  })

  it('regexp replace-all still skips locked cells (batch BE guard)', () => {
    const lockedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', locked: true },
      { key: 'age', title: 'Age' },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable columns={lockedCols} data={rows} rowKey="id" fnr onDataChange={onDataChange} />,
    )
    openFnr()
    queryFnr('/e/')
    expect(fnrMatches().length).toBe(2) // every /e/ hit is a locked name cell
    setReplace('X')
    fireEvent.click(document.querySelector('[data-iris-fnr-replace-all]')!)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(fnrMatches().length).toBe(2)
  })

  it('an empty query clears highlights as before', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('/l.ce/')
    expect(fnrMatches().length).toBe(2)
    queryFnr('')
    expect(fnrMatches().length).toBe(0)
  })
})
