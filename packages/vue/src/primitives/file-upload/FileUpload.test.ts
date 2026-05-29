import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisFileUpload, formatBytes } from './FileUpload'

afterEach(() => {})

function fileOf(name: string, size: number, type = 'text/plain'): File {
  const blob = new Blob([new ArrayBuffer(size)], { type })
  return new File([blob], name, { type })
}

describe('@iris-ui/vue formatBytes', () => {
  it('B / KB / MB / GB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB')
  })
})

describe('@iris-ui/vue IrisFileUpload', () => {
  it('renders zone + hidden input', () => {
    const wrap = mount(IrisFileUpload)
    expect(wrap.find('[data-iris-file-upload-zone]').exists()).toBe(true)
    expect(wrap.find('[data-iris-file-upload-input]').exists()).toBe(true)
  })

  it('default label rendered', () => {
    const wrap = mount(IrisFileUpload)
    expect(wrap.find('[data-iris-file-upload-label]').text()).toMatch(/Click or drop/)
  })

  it('multiple prop forwards to native input', () => {
    const wrap = mount(IrisFileUpload, { props: { multiple: true } })
    const input = wrap.find('[data-iris-file-upload-input]').element as HTMLInputElement
    expect(input.multiple).toBe(true)
  })

  it('accept prop forwards to native input', () => {
    const wrap = mount(IrisFileUpload, { props: { accept: 'image/*' } })
    const input = wrap.find('[data-iris-file-upload-input]').element as HTMLInputElement
    expect(input.accept).toBe('image/*')
  })

  it('selecting a file emits update:modelValue', async () => {
    const wrap = mount(IrisFileUpload, { props: { multiple: false } })
    const input = wrap.find('[data-iris-file-upload-input]').element as HTMLInputElement
    const file = fileOf('a.txt', 100)
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await wrap.find('[data-iris-file-upload-input]').trigger('change')
    const emit = wrap.emitted('update:modelValue')!
    expect(emit.length).toBe(1)
    expect((emit[0]![0] as { name: string }[])[0]!.name).toBe('a.txt')
  })

  it('multiple=false replaces selection on new input', async () => {
    const wrap = mount(IrisFileUpload, {
      props: {
        multiple: false,
        modelValue: [{ file: fileOf('old.txt', 1), name: 'old.txt', size: 1, type: 'text/plain' }],
      },
    })
    const input = wrap.find('[data-iris-file-upload-input]').element as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [fileOf('new.txt', 2)],
      configurable: true,
    })
    await wrap.find('[data-iris-file-upload-input]').trigger('change')
    const emit = wrap.emitted('update:modelValue')!
    const next = emit[0]![0] as { name: string }[]
    expect(next.length).toBe(1)
    expect(next[0]!.name).toBe('new.txt')
  })

  it('multiple=true appends to selection', async () => {
    const existing = { file: fileOf('a.txt', 1), name: 'a.txt', size: 1, type: 'text/plain' }
    const wrap = mount(IrisFileUpload, {
      props: { multiple: true, modelValue: [existing] },
    })
    const input = wrap.find('[data-iris-file-upload-input]').element as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [fileOf('b.txt', 2)],
      configurable: true,
    })
    await wrap.find('[data-iris-file-upload-input]').trigger('change')
    const emit = wrap.emitted('update:modelValue')!
    const next = emit[0]![0] as { name: string }[]
    expect(next.map((f) => f.name)).toEqual(['a.txt', 'b.txt'])
  })

  it('maxSize rejects oversized files', async () => {
    const wrap = mount(IrisFileUpload, { props: { maxSize: 100 } })
    const input = wrap.find('[data-iris-file-upload-input]').element as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [fileOf('big.txt', 200)],
      configurable: true,
    })
    await wrap.find('[data-iris-file-upload-input]').trigger('change')
    expect(wrap.emitted('reject')).toBeTruthy()
    expect(wrap.emitted('update:modelValue')?.[0]?.[0]).toEqual([])
  })

  it('accept filter rejects mismatched type', async () => {
    const wrap = mount(IrisFileUpload, { props: { accept: 'image/*' } })
    const input = wrap.find('[data-iris-file-upload-input]').element as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [fileOf('a.txt', 1, 'text/plain')],
      configurable: true,
    })
    await wrap.find('[data-iris-file-upload-input]').trigger('change')
    const reject = wrap.emitted('reject')!
    expect(reject.length).toBe(1)
    expect((reject[0]![0] as { reason: string }[])[0]!.reason).toBe('type')
  })

  it('drop event accepts files', async () => {
    const wrap = mount(IrisFileUpload)
    const file = fileOf('drop.txt', 50)
    const dt = { files: [file] }
    await wrap.find('[data-iris-file-upload-zone]').trigger('drop', {
      dataTransfer: dt as unknown as DataTransfer,
    })
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as { name: string }[])[0]!.name).toBe('drop.txt')
  })

  it('dragover sets data-drag-over and reverts on leave', async () => {
    const wrap = mount(IrisFileUpload)
    await wrap.find('[data-iris-file-upload-zone]').trigger('dragenter')
    expect(wrap.find('[data-iris-file-upload]').attributes('data-drag-over')).toBe('true')
    await wrap.find('[data-iris-file-upload-zone]').trigger('dragleave')
    expect(wrap.find('[data-iris-file-upload]').attributes('data-drag-over')).toBeUndefined()
  })

  it('renders file list when modelValue has entries', () => {
    const wrap = mount(IrisFileUpload, {
      props: {
        modelValue: [
          { file: fileOf('a.txt', 100), name: 'a.txt', size: 100, type: 'text/plain' },
          { file: fileOf('b.txt', 200), name: 'b.txt', size: 200, type: 'text/plain' },
        ],
      },
    })
    expect(wrap.findAll('[data-iris-file-upload-item]').length).toBe(2)
  })

  it('clicking remove emits update:modelValue without that file', async () => {
    const a = { file: fileOf('a.txt', 1), name: 'a.txt', size: 1, type: 'text/plain' }
    const b = { file: fileOf('b.txt', 2), name: 'b.txt', size: 2, type: 'text/plain' }
    const wrap = mount(IrisFileUpload, { props: { modelValue: [a, b] } })
    const removeBtns = wrap.findAll('button[aria-label^="Remove"]')
    expect(removeBtns.length).toBe(2)
    await removeBtns[0]!.trigger('click')
    const emit = wrap.emitted('update:modelValue')!
    const next = emit[0]![0] as { name: string }[]
    expect(next.map((f) => f.name)).toEqual(['b.txt'])
  })

  it('disabled prevents drop applying files', async () => {
    const wrap = mount(IrisFileUpload, { props: { disabled: true } })
    const dt = { files: [fileOf('x.txt', 1)] }
    await wrap.find('[data-iris-file-upload-zone]').trigger('drop', {
      dataTransfer: dt as unknown as DataTransfer,
    })
    expect(wrap.emitted('update:modelValue')).toBeUndefined()
  })

  it('id forwarded to hidden input (form field integration)', () => {
    const wrap = mount(IrisFileUpload, { props: { id: 'my-upload' } })
    expect((wrap.find('[data-iris-file-upload-input]').element as HTMLInputElement).id).toBe(
      'my-upload',
    )
  })
})

describe('@iris-ui/vue IrisFileUpload i18n', () => {
  it('renders the default localized label', () => {
    const w = mount(IrisFileUpload)
    expect(w.find('[data-iris-file-upload-label]').text()).toBe('Click or drop files to upload')
  })

  it('localizes the label via IrisI18nProvider', async () => {
    const { defineComponent, h } = await import('vue')
    const { IrisI18nProvider } = await import('../../i18n')
    const Probe = defineComponent({
      setup: () => () =>
        h(
          IrisI18nProvider,
          { messages: { 'fileUpload.label': 'Datei ablegen' } },
          { default: () => h(IrisFileUpload) },
        ),
    })
    const w = mount(Probe)
    expect(w.find('[data-iris-file-upload-label]').text()).toBe('Datei ablegen')
  })
})
