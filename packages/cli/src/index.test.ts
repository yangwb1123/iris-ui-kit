import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildManifest, discover, type IrisManifest } from '@iris-ui-kit/manifest'
import { runList } from './commands/list.js'
import { runScaffold } from './commands/scaffold.js'

// ---------------------------------------------------------------------------
// Minimal stub manifest
// ---------------------------------------------------------------------------

const STUB_MANIFEST: IrisManifest = {
  version: '0.0.0',
  generatedAt: '2026-01-01T00:00:00.000Z',
  components: [
    {
      name: 'IrisButton',
      group: 'primitives',
      module: 'button',
      frameworks: ['react', 'vue', 'solid', 'svelte'],
      importFrom: {
        react: '@iris-ui-kit/react',
        vue: '@iris-ui-kit/vue',
        solid: '@iris-ui-kit/solid',
        svelte: '@iris-ui-kit/svelte',
      },
      props: [
        { name: 'variant', type: 'string', optional: true },
        { name: 'onClick', type: '() => void', optional: false },
      ],
      frameworkContracts: {
        react: {
          source: 'native',
          props: [
            { name: 'variant', type: 'string', optional: true },
            { name: 'onClick', type: '() => void', optional: false },
          ],
          events: ['onClick'],
          slots: [],
          publicTypes: ['IrisButtonProps'],
        },
        vue: {
          source: 'native',
          props: [{ name: 'vueOnlyRequired', type: 'string', optional: false }],
          events: ['click'],
          slots: ['default'],
          publicTypes: [],
        },
      },
    },
    {
      name: 'IrisInput',
      group: 'form',
      module: 'input',
      frameworks: ['react', 'vue'],
      importFrom: {
        react: '@iris-ui-kit/react',
        vue: '@iris-ui-kit/vue',
      },
      props: [{ name: 'value', type: 'string', optional: false }],
    },
    {
      name: 'IrisCard',
      group: 'layouts',
      module: 'card',
      frameworks: ['react', 'vue', 'solid', 'svelte'],
      importFrom: {
        react: '@iris-ui-kit/react',
        vue: '@iris-ui-kit/vue',
        solid: '@iris-ui-kit/solid',
        svelte: '@iris-ui-kit/svelte',
      },
      props: [],
    },
  ],
} as unknown as IrisManifest
const REAL_MANIFEST = buildManifest(discover())

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
// list command
// ---------------------------------------------------------------------------

describe('list command', () => {
  let io: ReturnType<typeof captureOutput>

  beforeEach(() => {
    io = captureOutput()
  })

  afterEach(() => {
    io.restore()
    vi.restoreAllMocks()
  })

  it('returns all components when no group filter given', () => {
    const code = runList(STUB_MANIFEST)
    expect(code).toBe(0)
    const out = io.stdout.join('')
    expect(out).toContain('IrisButton')
    expect(out).toContain('IrisInput')
    expect(out).toContain('IrisCard')
  })

  it('includes framework list and group in output', () => {
    const code = runList(STUB_MANIFEST)
    expect(code).toBe(0)
    const out = io.stdout.join('')
    expect(out).toContain('[react, vue, solid, svelte]')
    expect(out).toContain('primitives')
  })

  it('filters by group when --group given', () => {
    const code = runList(STUB_MANIFEST, 'primitives')
    expect(code).toBe(0)
    const out = io.stdout.join('')
    expect(out).toContain('IrisButton')
    expect(out).not.toContain('IrisInput')
    expect(out).not.toContain('IrisCard')
  })

  it('returns exit code 1 and stderr when group has no results', () => {
    const code = runList(STUB_MANIFEST, 'nonexistent')
    expect(code).toBe(1)
    expect(io.stderr.join('')).toContain('nonexistent')
  })
})

// ---------------------------------------------------------------------------
// scaffold command
// ---------------------------------------------------------------------------

describe('scaffold command', () => {
  let io: ReturnType<typeof captureOutput>

  beforeEach(() => {
    io = captureOutput()
  })

  afterEach(() => {
    io.restore()
    vi.restoreAllMocks()
  })

  it('scaffold Button react returns a snippet with import and usage', () => {
    const code = runScaffold(STUB_MANIFEST, 'IrisButton', 'react')
    expect(code).toBe(0)
    const out = io.stdout.join('')
    expect(out).toContain("import { IrisButton } from '@iris-ui-kit/react'")
    expect(out).toContain('<IrisButton')
  })

  it('scaffold Button vue returns Vue attribute syntax', () => {
    const code = runScaffold(STUB_MANIFEST, 'IrisButton', 'vue')
    expect(code).toBe(0)
    const out = io.stdout.join('')
    expect(out).toContain("import { IrisButton } from '@iris-ui-kit/vue'")
    expect(out).toContain(':vueOnlyRequired="/* string */"')
    expect(out).not.toContain(':onClick=')
  })

  it('required props appear in the snippet', () => {
    const code = runScaffold(STUB_MANIFEST, 'IrisButton', 'react')
    expect(code).toBe(0)
    // onClick is required — should appear as a placeholder
    expect(io.stdout.join('')).toContain('onClick')
  })

  it.each([
    ['IrisProTable', 'store'],
    ['IrisFormBuilder', 'schema'],
  ])('scaffolds required Svelte %s.%s from the generated manifest', (component, prop) => {
    const code = runScaffold(REAL_MANIFEST, component, 'svelte')
    expect(code).toBe(0)
    const out = io.stdout.join('')
    expect(out).toContain(`from '@iris-ui-kit/plugin-`)
    expect(out).toContain(`<${component} ${prop}={/*`)
  })

  it('scaffold UnknownComponent exits 1 with error message', () => {
    const code = runScaffold(STUB_MANIFEST, 'IrisNonExistent', 'react')
    expect(code).toBe(1)
    expect(io.stderr.join('')).toContain('"IrisNonExistent"')
  })

  it('exits 1 for unsupported framework on a component', () => {
    // IrisInput only supports react and vue, not solid
    const code = runScaffold(STUB_MANIFEST, 'IrisInput', 'solid')
    expect(code).toBe(1)
    expect(io.stderr.join('')).toContain('solid')
  })

  it('list with group filter shows only matching group', () => {
    const io2 = captureOutput()
    const code = runList(STUB_MANIFEST, 'primitives')
    expect(code).toBe(0)
    const out = io2.stdout.join('')
    expect(out).toContain('IrisButton')
    io2.restore()
  })

  it('list with no group filter shows all components', () => {
    const io2 = captureOutput()
    const code = runList(STUB_MANIFEST, undefined)
    expect(code).toBe(0)
    const out = io2.stdout.join('')
    expect(out).toContain('IrisButton')
    expect(out).toContain('IrisInput')
    io2.restore()
  })
})
