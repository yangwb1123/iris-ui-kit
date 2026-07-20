import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runCodemodList, runCodemodRun } from './codemod.js'
import { CODEMODS } from '../codemods/registry.js'

// ---------------------------------------------------------------------------
// Capture stdout / stderr writes
// ---------------------------------------------------------------------------

function captureOutput(): { stdout: string[]; stderr: string[]; restore: () => void } {
  const stdout: string[] = []
  const stderr: string[] = []
  const origOut = process.stdout.write.bind(process.stdout)
  const origErr = process.stderr.write.bind(process.stderr)
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdout.push(String(chunk))
    return true
  })
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderr.push(String(chunk))
    return true
  })
  return {
    stdout,
    stderr,
    restore: () => {
      process.stdout.write = origOut
      process.stderr.write = origErr
    },
  }
}

// ---------------------------------------------------------------------------
// Temp fixture dir
// ---------------------------------------------------------------------------

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'iris-cli-codemod-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// codemod list
// ---------------------------------------------------------------------------

describe('codemod list', () => {
  let io: ReturnType<typeof captureOutput>

  beforeEach(() => {
    io = captureOutput()
  })

  afterEach(() => {
    io.restore()
    vi.restoreAllMocks()
  })

  it('includes the toast-error-to-danger example codemod with its description', () => {
    const code = runCodemodList()
    expect(code).toBe(0)
    const out = io.stdout.join('')
    expect(out).toContain('toast-error-to-danger')
    expect(out).toContain("'error'")
    expect(out).toContain("'danger'")
  })

  it('the registry is non-empty', () => {
    expect(CODEMODS.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// codemod run
// ---------------------------------------------------------------------------

describe('codemod run', () => {
  let io: ReturnType<typeof captureOutput>

  beforeEach(() => {
    io = captureOutput()
  })

  afterEach(() => {
    io.restore()
    vi.restoreAllMocks()
  })

  it('returns exit code 1 for an unknown codemod name', () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, "notify({ tone: 'error' })\n")
    const code = runCodemodRun('does-not-exist', file)
    expect(code).toBe(1)
    expect(io.stderr.join('')).toContain('does-not-exist')
  })

  it('returns exit code 1 when no files match the target', () => {
    const code = runCodemodRun('toast-error-to-danger', join(dir, 'nope.ts'))
    expect(code).toBe(1)
    expect(io.stderr.join('')).toContain('no files matched')
  })

  it('--dry-run does not write the file but reports what would change', () => {
    const file = join(dir, 'a.ts')
    const original = "notify({ title: 'Save failed', tone: 'error' })\n"
    writeFileSync(file, original)

    const code = runCodemodRun('toast-error-to-danger', file, { dryRun: true })

    expect(code).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe(original) // untouched on disk
    const out = io.stdout.join('')
    expect(out).toContain('would change')
    expect(out).toContain("- notify({ title: 'Save failed', tone: 'error' })")
    expect(out).toContain("+ notify({ title: 'Save failed', tone: 'danger' })")
  })

  it('rewrites a matching file in place and reports it changed', () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, "pushToast({ title: 'Boom', variant: 'error' })\n")

    const code = runCodemodRun('toast-error-to-danger', file)

    expect(code).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe("pushToast({ title: 'Boom', variant: 'danger' })\n")
    expect(io.stdout.join('')).toContain('changed')
  })

  it('is idempotent: running a second time reports the file unchanged', () => {
    const file = join(dir, 'a.ts')
    writeFileSync(file, "pushToast({ title: 'Boom', variant: 'error' })\n")

    runCodemodRun('toast-error-to-danger', file)
    const afterFirst = readFileSync(file, 'utf8')

    io.restore()
    vi.restoreAllMocks()
    io = captureOutput()

    const code = runCodemodRun('toast-error-to-danger', file)
    expect(code).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe(afterFirst)
    expect(io.stdout.join('')).toContain('unchanged')
    expect(io.stdout.join('')).toContain('0 of 1 file(s) changed.')
  })

  it('leaves a file with no matches byte-identical', () => {
    const file = join(dir, 'a.ts')
    const original = "const greeting = 'hello world'\n"
    writeFileSync(file, original)

    const code = runCodemodRun('toast-error-to-danger', file)

    expect(code).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe(original)
    expect(io.stdout.join('')).toContain('unchanged')
  })

  it('walks a directory target and rewrites every matching file within it', () => {
    mkdirSync(join(dir, 'nested'))
    writeFileSync(join(dir, 'one.ts'), "notify({ tone: 'error' })\n")
    writeFileSync(join(dir, 'nested', 'two.ts'), "notify({ tone: 'error' })\n")
    writeFileSync(join(dir, 'three.md'), 'tone: error is just prose here\n')

    const code = runCodemodRun('toast-error-to-danger', dir)

    expect(code).toBe(0)
    expect(readFileSync(join(dir, 'one.ts'), 'utf8')).toContain("tone: 'danger'")
    expect(readFileSync(join(dir, 'nested', 'two.ts'), 'utf8')).toContain("tone: 'danger'")
    expect(io.stdout.join('')).toContain('2 of 3 file(s) changed.')
  })
})
