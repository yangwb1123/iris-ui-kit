import { describe, expect, it } from 'vitest'
import { renderToString } from 'solid-js/web'
import { IrisProvider } from './IrisProvider'
import { IrisInput } from '../primitives/input/Input'
import { IrisFormField } from '../primitives/form-field/FormField'
import { IrisDialog } from '../primitives/dialog/IrisDialog'
import { IrisDialogContent, IrisDialogTitle } from '../primitives/dialog/IrisDialogContent'
import { IrisAdminLayout } from '../admin/AdminLayout'
import { createTabsNav, type Size } from '@iris-ui-kit/core'

// Server output only. This does not claim client hydration or browser geometry.
describe('control/layout SSR', () => {
  it.each(['sm', 'lg'] as Size[])('inherits %s through forms and composed admin chrome', (size) => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(() => (
      <IrisProvider componentSize={size}>
        <IrisFormField label="Quantity" labelPlacement="start" controlWidth="12rem" hint="Units">
          <IrisInput fullWidth />
        </IrisFormField>
        <IrisInput size="md" aria-label="Explicit" />
        <IrisAdminLayout menus={[{ key: 'a', title: 'A' }]} tabs={createTabsNav()} />
      </IrisProvider>
    ))
    expect(html).toContain(`data-iris-input-size="${size}"`)
    expect(html).toContain('data-iris-input-size="md"')
    expect(html).toContain('data-iris-form-field-control')
    expect(html).toContain('width:12rem')
    expect(html).toContain('aria-describedby=')
    expect(html).toContain(`data-iris-size="${size}"`)
    expect(html).toContain('data-iris-nav-menu')
    expect(html).toContain('data-iris-admin-tabs')
  })

  it('renders gutter-clamped dialog sizing without touching browser globals', () => {
    const html = renderToString(() => (
      <IrisDialog defaultOpen>
        <IrisDialogContent size="xl" portalTarget={false}>
          <IrisDialogTitle>Title</IrisDialogTitle>
        </IrisDialogContent>
      </IrisDialog>
    ))
    expect(html).toContain('width:60rem')
    expect(html).toContain('max-width:calc(100vw - 48px)')
    expect(html).toContain('max-height:min(85vh, calc(100vh - 48px))')
  })
})
