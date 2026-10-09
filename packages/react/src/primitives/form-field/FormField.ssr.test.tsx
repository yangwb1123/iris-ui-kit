// @vitest-environment node
//
// Server-render guard for the field/dialog layout props. Node env — no
// `document`, no `window`, no layout engine — so this only proves the new
// declarations are render-safe on a server pass (no DOM access, ids and ARIA
// wiring stable, horizontal geometry present in the emitted markup) and that
// the default field still emits its original markup.
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IrisFormField } from './FormField'
import { IrisInput } from '../input/Input'
import { IrisDialog } from '../dialog/Dialog'
import { IrisDialogContent, IrisDialogTitle } from '../dialog/DialogContent'

describe('@iris-ui-kit/react form-field / dialog layout SSR guard', () => {
  it('renders the default field exactly as before', () => {
    const html = renderToStaticMarkup(
      <IrisFormField label="Email" hint="Work address">
        <IrisInput />
      </IrisFormField>,
    )
    expect(html).toContain('display:flex;flex-direction:column;gap:4px')
    expect(html).not.toContain('data-iris-form-field-control')
    expect(html).not.toContain('data-iris-form-field-placement')
  })

  it('renders the horizontal layout with its control column and label sizing', () => {
    const html = renderToStaticMarkup(
      <IrisFormField
        label="Email"
        labelPlacement="start"
        labelWidth={120}
        controlWidth="20rem"
        fullWidth
        error="Required"
      >
        <IrisInput />
      </IrisFormField>,
    )
    expect(html).toContain('data-iris-form-field-placement="start"')
    expect(html).toContain('flex-direction:row')
    expect(html).toContain('box-sizing:border-box')
    expect(html).toContain('min-width:0')
    expect(html).toContain('width:120px')
    expect(html).toContain('data-iris-form-field-control')
    expect(html).toContain('width:20rem')
    // ARIA wiring survives the server pass
    expect(html).toContain('aria-invalid="true"')
    expect(html).toMatch(/aria-describedby="[^"]+-error"/)
  })

  it('keeps generated ids stable across two server renders', () => {
    const tree = (): React.ReactElement => (
      <IrisFormField label="Email" labelPlacement="start" hint="Work address">
        <IrisInput />
      </IrisFormField>
    )
    expect(renderToStaticMarkup(tree())).toBe(renderToStaticMarkup(tree()))
  })

  it('renders a sized dialog surface without touching the DOM', () => {
    const html = renderToStaticMarkup(
      <IrisDialog defaultOpen>
        <IrisDialogContent size="lg" portalTarget={false}>
          <IrisDialogTitle>Title</IrisDialogTitle>
        </IrisDialogContent>
      </IrisDialog>,
    )
    expect(html).toContain('data-iris-dialog-size="lg"')
    expect(html).toContain('width:50rem')
    expect(html).toContain('max-width:calc(100vw - 48px)')
    expect(html).toContain('max-height:min(85vh, calc(100vh - 48px))')
    expect(html).toContain('role="dialog"')
  })
})
