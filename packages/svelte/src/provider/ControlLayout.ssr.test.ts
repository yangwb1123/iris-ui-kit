import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import type { Size } from '@iris-ui-kit/core'
import Harness from './ControlLayoutSsrHarness.svelte'

// Server output only. Hydration and actual layout need separate browser evidence.
describe('control/layout SSR', () => {
  it.each(['sm', 'lg'] as Size[])('inherits %s through forms and composed admin chrome', (size) => {
    expect(typeof window).toBe('undefined')
    const html = render(Harness, { props: { componentSize: size } }).body
    expect(html).toContain(`data-iris-input-size="${size}"`)
    expect(html).toContain('data-iris-input-size="md"')
    expect(html).toContain('data-iris-form-field-control')
    expect(html).toContain('width: 12rem')
    expect(html).toContain('aria-describedby=')
    expect(html).toContain(`data-iris-size="${size}"`)
    expect(html).toContain('data-iris-nav-menu')
    expect(html).toContain('data-iris-admin-tabs')
    expect(html).toContain('width: 60rem')
    expect(html).toContain('max-width: calc(100vw - 48px)')
    expect(html).toContain('max-height: min(85vh, calc(100vh - 48px))')
  })
})
