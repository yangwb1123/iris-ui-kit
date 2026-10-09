// @vitest-environment node
//
// Server-render guard for the field/dialog layout props: no DOM globals exist
// here, so a passing render proves the new declarations never reach for the
// document at render time and that the emitted markup (geometry + ARIA wiring)
// is deterministic across renders.
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisFormField } from './FormField'
import { IrisInput } from '../input/Input'
import { IrisDialog } from '../dialog/Dialog'
import { IrisDialogContent, IrisDialogTitle } from '../dialog/DialogContent'

describe('@iris-ui-kit/vue form-field / dialog layout SSR guard', () => {
  it('renders the default field with its original geometry', async () => {
    const app = createSSRApp({
      render: () => h(IrisFormField, { label: 'Email', hint: 'Work' }, () => h(IrisInput)),
    })
    const html = await renderToString(app)
    expect(html).toContain('display:flex;flex-direction:column;gap:4px')
    expect(html).not.toContain('data-iris-form-field-control')
    expect(html).not.toContain('data-iris-form-field-placement')
    expect(html).toMatch(/aria-describedby="/)
  })

  it('renders the horizontal layout with its control column', async () => {
    const app = createSSRApp({
      render: () =>
        h(
          IrisFormField,
          {
            label: 'Email',
            labelPlacement: 'start',
            labelWidth: 120,
            controlWidth: '20rem',
            fullWidth: true,
            error: 'Required',
          },
          () => h(IrisInput),
        ),
    })
    const html = await renderToString(app)
    expect(html).toContain('data-iris-form-field-placement="start"')
    expect(html).toContain('flex-direction:row')
    expect(html).toContain('box-sizing:border-box')
    expect(html).toContain('min-width:0')
    expect(html).toContain('width:120px')
    expect(html).toContain('data-iris-form-field-control')
    expect(html).toContain('width:20rem')
    expect(html).toMatch(/aria-invalid="true"/)
  })

  it('keeps generated ids stable across two server renders', async () => {
    const render = (): Promise<string> =>
      renderToString(
        createSSRApp({
          render: () =>
            h(IrisFormField, { labelPlacement: 'start', label: 'Email' }, () => h(IrisInput)),
        }),
      )
    expect(await render()).toBe(await render())
  })

  it('renders a sized dialog surface without touching the DOM', async () => {
    const app = createSSRApp({
      render: () =>
        h(IrisDialog, { defaultOpen: true }, () =>
          h(IrisDialogContent, { size: 'lg', teleport: false }, () =>
            h(IrisDialogTitle, null, () => 'Title'),
          ),
        ),
    })
    const html = await renderToString(app)
    expect(html).toContain('data-iris-dialog-size="lg"')
    expect(html).toContain('width:50rem')
    expect(html).toContain('max-width:calc(100vw - 48px)')
    expect(html).toContain('role="dialog"')
  })
})
