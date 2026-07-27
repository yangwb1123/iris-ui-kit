import { fireEvent, render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import IrisTagInput from './IrisTagInput.svelte'

function field(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-tag-input-field]') as HTMLInputElement
}

function tags(container: HTMLElement): NodeListOf<HTMLElement> {
  return container.querySelectorAll('[data-iris-tag-input-tag]')
}

function removes(container: HTMLElement): NodeListOf<HTMLButtonElement> {
  return container.querySelectorAll('[data-iris-tag-input-remove]')
}

async function type(container: HTMLElement, value: string): Promise<void> {
  await fireEvent.input(field(container), { target: { value } })
  flushSync()
}

describe('IrisTagInput', () => {
  it('renders controlled tags with stable data values and removal controls', () => {
    const { container } = render(IrisTagInput, {
      props: { value: ['alpha', 'beta'] },
    })

    expect(tags(container)).toHaveLength(2)
    expect([...tags(container)].map((tag) => tag.getAttribute('data-value'))).toEqual([
      'alpha',
      'beta',
    ])
    expect([...tags(container)].map((tag) => tag.firstChild?.textContent?.trim())).toEqual([
      'alpha',
      'beta',
    ])
    expect(removes(container)).toHaveLength(2)
  })

  it('shows the placeholder only when no tags are present', () => {
    const empty = render(IrisTagInput, {
      props: { value: [], placeholder: 'Add a technology' },
    })
    expect(field(empty.container).placeholder).toBe('Add a technology')
    empty.unmount()

    const populated = render(IrisTagInput, {
      props: { value: ['Svelte'], placeholder: 'Add a technology' },
    })
    expect(field(populated.container).placeholder).toBe('')
  })

  it('trims and commits a non-empty tag on Enter', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, { props: { value: [], onchange } })

    await type(container, '  production  ')
    await fireEvent.keyDown(field(container), { key: 'Enter' })
    flushSync()

    expect(onchange).toHaveBeenCalledOnce()
    expect(onchange).toHaveBeenCalledWith(['production'])
    expect(field(container).value).toBe('')
  })

  it('clears whitespace input without emitting a tag', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, { props: { onchange } })

    await type(container, '   ')
    await fireEvent.keyDown(field(container), { key: 'Enter' })
    flushSync()

    expect(onchange).not.toHaveBeenCalled()
    expect(field(container).value).toBe('')
  })

  it('commits every complete comma-delimited tag and keeps the unfinished tail', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['existing'], onchange },
    })

    await type(container, ' alpha, beta,unfinished')

    expect(onchange).toHaveBeenCalledOnce()
    expect(onchange).toHaveBeenCalledWith(['existing', 'alpha', 'beta'])
    expect(field(container).value).toBe('unfinished')
  })

  it('skips empty and duplicate entries within comma-delimited input', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['alpha'], onchange },
    })

    await type(container, 'alpha, ,beta,')

    expect(onchange).toHaveBeenCalledOnce()
    expect(onchange).toHaveBeenCalledWith(['alpha', 'beta'])
    expect(field(container).value).toBe('')
  })

  it('prevents duplicate tags by default', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['release'], onchange },
    })

    await type(container, 'release')
    await fireEvent.keyDown(field(container), { key: 'Enter' })
    flushSync()

    expect(onchange).not.toHaveBeenCalled()
    expect(field(container).value).toBe('')
  })

  it('allows duplicates when allowDuplicates is enabled', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['release'], allowDuplicates: true, onchange },
    })

    await type(container, 'release')
    await fireEvent.keyDown(field(container), { key: 'Enter' })
    flushSync()

    expect(onchange).toHaveBeenCalledWith(['release', 'release'])
  })

  it('enforces max across a batch of comma-separated candidates', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['one'], max: 3, onchange },
    })

    await type(container, 'two,three,four,tail')

    expect(onchange).toHaveBeenCalledWith(['one', 'two', 'three'])
    expect(onchange.mock.calls[0]![0]).toHaveLength(3)
    expect(field(container).value).toBe('tail')
  })

  it('does not emit when Enter would exceed max', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['only'], max: 1, onchange },
    })

    await type(container, 'blocked')
    await fireEvent.keyDown(field(container), { key: 'Enter' })
    flushSync()

    expect(onchange).not.toHaveBeenCalled()
    expect(field(container).value).toBe('')
  })

  it('Backspace on an empty field removes the last tag', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['first', 'last'], onchange },
    })

    await fireEvent.keyDown(field(container), { key: 'Backspace' })
    flushSync()

    expect(onchange).toHaveBeenCalledWith(['first'])
  })

  it('Backspace preserves tags while the field contains text', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['first', 'last'], onchange },
    })

    await type(container, 'draft')
    await fireEvent.keyDown(field(container), { key: 'Backspace' })
    flushSync()

    expect(onchange).not.toHaveBeenCalled()
    expect(field(container).value).toBe('draft')
  })

  it('a remove button removes only its corresponding tag', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['alpha', 'beta', 'gamma'], onchange },
    })

    await fireEvent.click(removes(container)[1]!)
    flushSync()

    expect(onchange).toHaveBeenCalledWith(['alpha', 'gamma'])
    expect(removes(container)[1]!.getAttribute('aria-label')).toBe('Remove beta')
  })

  it('disabled state blocks input and tag removal', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, {
      props: { value: ['locked'], disabled: true, onchange },
    })

    expect(field(container).disabled).toBe(true)
    expect(removes(container)[0]!.disabled).toBe(true)
    expect(container.querySelector<HTMLElement>('[data-iris-tag-input]')!.style.opacity).toBe('0.6')
    await fireEvent.click(removes(container)[0]!)
    flushSync()
    expect(onchange).not.toHaveBeenCalled()
  })

  it('announces invalid state and gives it visual precedence', async () => {
    const { container } = render(IrisTagInput, { props: { invalid: true } })
    const root = container.querySelector('[data-iris-tag-input]') as HTMLElement

    expect(root.getAttribute('data-state')).toBe('invalid')
    expect(root.getAttribute('style')).toContain('var(--iris-danger)')
    expect(field(container).getAttribute('aria-invalid')).toBe('true')
    await fireEvent.focus(field(container))
    flushSync()
    expect(root.getAttribute('data-state')).toBe('invalid')
    expect(root.getAttribute('style')).toContain('var(--iris-danger)')
  })

  it('tracks focus and blur for focus-ring state', async () => {
    const { container } = render(IrisTagInput)
    const root = container.querySelector('[data-iris-tag-input]') as HTMLElement

    expect(root.getAttribute('data-state')).toBe('idle')
    await fireEvent.focus(field(container))
    flushSync()
    expect(root.getAttribute('data-state')).toBe('focused')
    expect(root.getAttribute('style')).toContain('var(--iris-primary)')

    await fireEvent.blur(field(container))
    flushSync()
    expect(root.getAttribute('data-state')).toBe('idle')
    expect(root.getAttribute('style')).toContain('box-shadow: none')
  })

  it('forwards form wiring and root attributes while merging custom style', () => {
    const { container } = render(IrisTagInput, {
      props: {
        id: 'skills',
        ariaDescribedby: 'skills-help',
        style: 'width: 420px',
        'data-testid': 'skills-control',
      },
    })
    const root = container.querySelector('[data-iris-tag-input]') as HTMLElement

    expect(field(container).id).toBe('skills')
    expect(field(container).getAttribute('aria-describedby')).toBe('skills-help')
    expect(root.getAttribute('data-testid')).toBe('skills-control')
    expect(root.style.width).toBe('420px')
    expect(root.style.display).toBe('flex')
  })

  it('reflects controlled tag changes after rerender', async () => {
    const onchange = vi.fn()
    const { container, rerender } = render(IrisTagInput, {
      props: { value: ['alpha'], onchange },
    })
    expect(tags(container)).toHaveLength(1)

    await rerender({ value: ['alpha', 'beta', 'gamma'], onchange })
    flushSync()
    expect(tags(container)).toHaveLength(3)
    expect([...tags(container)].map((tag) => tag.getAttribute('data-value'))).toEqual([
      'alpha',
      'beta',
      'gamma',
    ])
    expect(onchange).not.toHaveBeenCalled()
  })
})
