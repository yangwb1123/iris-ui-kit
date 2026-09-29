import { render } from '@testing-library/svelte'
import { hydrate, tick, unmount } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import FormFieldPropsHarness from './FormFieldPropsHarness.svelte'
import FormFieldHarness from './FormFieldHarness.svelte'

// Captured from `svelte/server` for the same tree. Keeping the hydration
// markers here lets this client-side suite exercise the actual hydrate path;
// the `$props.id()` marker is what carries `s1` from SSR into the client.
const FORM_FIELD_SSR =
  '<!--[--><!--$s1--><div data-iris-form-field="true" data-iris-form-field-state="valid" style="display: flex; flex-direction: column; gap: 4px"><!--[0--><label for="s1-control" data-iris-form-field-label="" style="font-size: var(--iris-font-size-md, 14px); font-weight: 500; color: var(--iris-foreground); display: inline-flex; align-items: center; gap: 4px">Email <!--[-1--><!--]--></label><!--]--> <label data-iris-input="" data-iris-input-size="md" data-state="idle" style="display: inline-flex; align-items: center; gap: var(--iris-space-xs, 8px); background: var(--iris-background); color: var(--iris-foreground); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); cursor: text; opacity: 1; transition: border-color 120ms ease, box-shadow 120ms ease; box-shadow: none; padding: var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px); min-height: 34px; font-size: var(--iris-font-size-md, 14px)"><!--[-1--><!--]--> <input id="s1-control" type="text" aria-describedby="s1-hint" style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: inherit; font-family: inherit; font-size: inherit; padding: 0"/> <!--[-1--><!--]--></label><!----> <!--[0--><div id="s1-hint" data-iris-form-field-hint="" style="font-size: var(--iris-font-size-xs, 12px); color: var(--iris-muted)">We never share it.</div><!--]--> <!--[-1--><!--]--></div><!--]-->'

describe('@iris-ui-kit/svelte IrisFormField', () => {
  it('renders a wrapper with data-iris-form-field', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'Name' } })
    expect(container.querySelector('[data-iris-form-field]')).not.toBeNull()
  })

  it('label for matches the input id (auto-generated)', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'Email' } })
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    const input = container.querySelector('input')!
    expect(label).not.toBeNull()
    expect(input.id).toBeTruthy()
    expect(label.getAttribute('for')).toBe(input.id)
  })

  it('labelFor override pins the control id', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', labelFor: 'explicit-id' },
    })
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    const input = container.querySelector('input')!
    expect(label.getAttribute('for')).toBe('explicit-id')
    expect(input.id).toBe('explicit-id')
  })

  it('renders hint with id and links via aria-describedby when no error', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', hint: 'Must be 8+ chars' },
    })
    const hint = container.querySelector('[data-iris-form-field-hint]') as HTMLDivElement
    const input = container.querySelector('input')!
    expect(hint).not.toBeNull()
    expect(hint.id).toBeTruthy()
    expect(input.getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('renders error with role="alert" and links via aria-describedby', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', error: 'Required' },
    })
    const err = container.querySelector('[data-iris-form-field-error]') as HTMLDivElement
    const input = container.querySelector('input')!
    expect(err).not.toBeNull()
    expect(err.getAttribute('role')).toBe('alert')
    expect(input.getAttribute('aria-describedby')).toBe(err.id)
  })

  it('error hides hint and sets state="invalid"', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', hint: 'Hint text', error: 'Required' },
    })
    expect(container.querySelector('[data-iris-form-field-hint]')).toBeNull()
    expect(
      container.querySelector('[data-iris-form-field]')?.getAttribute('data-iris-form-field-state'),
    ).toBe('invalid')
  })

  it('error propagates aria-invalid to the wrapped input', () => {
    const { container } = render(FormFieldPropsHarness, {
      props: { label: 'X', error: 'Required' },
    })
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
  })

  it('required renders the asterisk indicator', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'X', required: true } })
    const ind = container.querySelector('[data-iris-form-field-required]')
    expect(ind?.textContent).toBe('*')
  })

  it('omits label when not provided', () => {
    const { container } = render(FormFieldPropsHarness, {})
    expect(container.querySelector('label[data-iris-form-field-label]')).toBeNull()
  })

  it('size="sm" affects label font-size', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'X', size: 'sm' } })
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    expect(label.getAttribute('style')).toContain('font-size: var(--iris-font-size-xs, 12px)')
  })

  it('label color flips to danger when error present', () => {
    const { container } = render(FormFieldPropsHarness, { props: { label: 'X', error: 'bad' } })
    const label = container.querySelector('label[data-iris-form-field-label]') as HTMLLabelElement
    expect(label.getAttribute('style')).toContain('var(--iris-danger)')
  })

  it('hydrates SSR ids and keeps label/description references attached', async () => {
    const target = document.createElement('div')
    target.innerHTML = FORM_FIELD_SSR
    document.body.appendChild(target)
    const warnings: unknown[][] = []
    const errors: unknown[][] = []
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => warnings.push(args))
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args))
    let instance: ReturnType<typeof hydrate> | undefined

    try {
      instance = hydrate(FormFieldHarness, {
        target,
        props: { label: 'Email', hint: 'We never share it.' },
      })
      await tick()

      const label = target.querySelector('label[data-iris-form-field-label]')!
      const input = target.querySelector('input')!
      const hint = target.querySelector('[data-iris-form-field-hint]')!
      expect(label.getAttribute('for')).toBe(input.id)
      expect(input.getAttribute('aria-describedby')).toBe(hint.id)
      expect(target.querySelector(`[id="${hint.id}"]`)).toBe(hint)
      expect(
        [...warnings, ...errors].filter((args) =>
          args.some((arg) => typeof arg === 'string' && /hydration|mismatch/i.test(arg)),
        ),
      ).toEqual([])
    } finally {
      warn.mockRestore()
      error.mockRestore()
      if (instance) await unmount(instance)
      target.remove()
    }
  })
})
