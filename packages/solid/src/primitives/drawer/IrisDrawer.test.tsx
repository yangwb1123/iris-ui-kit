import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisDrawer } from './IrisDrawer'
import { IrisDrawerTrigger } from './IrisDrawerTrigger'
import { IrisDrawerContent, IrisDrawerTitle, IrisDrawerClose } from './IrisDrawerContent'

afterEach(cleanup)

// Note: IrisDrawerContent always uses Portal, so we test with getByRole on document.body
// or verify the mounted/visible state through other means.

describe('IrisDrawer', () => {
  it('renders trigger without crashing', () => {
    const { getByText } = render(() => (
      <IrisDrawer>
        <IrisDrawerTrigger>Open Drawer</IrisDrawerTrigger>
        <IrisDrawerContent>Drawer body</IrisDrawerContent>
      </IrisDrawer>
    ))
    expect(getByText('Open Drawer')).toBeTruthy()
  })

  it('trigger has correct attributes before open', () => {
    const { container } = render(() => (
      <IrisDrawer>
        <IrisDrawerTrigger>Open</IrisDrawerTrigger>
        <IrisDrawerContent>Content</IrisDrawerContent>
      </IrisDrawer>
    ))
    const button = container.querySelector('button')!
    expect(button.getAttribute('data-state')).toBe('closed')
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('opens drawer on trigger click (visible in document.body)', () => {
    const { getByText } = render(() => (
      <IrisDrawer>
        <IrisDrawerTrigger>Open</IrisDrawerTrigger>
        <IrisDrawerContent>
          <IrisDrawerTitle>Drawer Title</IrisDrawerTitle>
          Content
        </IrisDrawerContent>
      </IrisDrawer>
    ))
    fireEvent.click(getByText('Open'))
    // Portal renders into document.body
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.body.querySelector('[data-iris-drawer-title]')).not.toBeNull()
  })

  it('close button is rendered inside drawer', () => {
    const { getByText } = render(() => (
      <IrisDrawer>
        <IrisDrawerTrigger>Open</IrisDrawerTrigger>
        <IrisDrawerContent>
          <IrisDrawerClose>Close</IrisDrawerClose>
        </IrisDrawerContent>
      </IrisDrawer>
    ))
    fireEvent.click(getByText('Open'))
    expect(document.body.querySelector('[data-iris-drawer-close]')).not.toBeNull()
  })
})
