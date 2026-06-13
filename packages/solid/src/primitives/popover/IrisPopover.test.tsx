import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisPopover } from './IrisPopover'
import { IrisPopoverTrigger } from './IrisPopoverTrigger'
import { IrisPopoverContent } from './IrisPopoverContent'

afterEach(cleanup)

describe('IrisPopover', () => {
  it('renders trigger without crashing', () => {
    const { getByText } = render(() => (
      <IrisPopover>
        <IrisPopoverTrigger>Open</IrisPopoverTrigger>
        <IrisPopoverContent portalTarget={false}>Content</IrisPopoverContent>
      </IrisPopover>
    ))
    expect(getByText('Open')).toBeTruthy()
  })

  it('shows content on trigger click', () => {
    const { getByText, queryByRole } = render(() => (
      <IrisPopover>
        <IrisPopoverTrigger>Open</IrisPopoverTrigger>
        <IrisPopoverContent portalTarget={false}>Popover content</IrisPopoverContent>
      </IrisPopover>
    ))
    expect(queryByRole('dialog')).toBeNull()
    fireEvent.click(getByText('Open'))
    expect(queryByRole('dialog')).not.toBeNull()
    expect(queryByRole('dialog')?.textContent).toBe('Popover content')
  })

  it('closes on second trigger click', () => {
    const { getByText, queryByRole } = render(() => (
      <IrisPopover>
        <IrisPopoverTrigger>Open</IrisPopoverTrigger>
        <IrisPopoverContent portalTarget={false}>Content</IrisPopoverContent>
      </IrisPopover>
    ))
    fireEvent.click(getByText('Open'))
    expect(queryByRole('dialog')).not.toBeNull()
    fireEvent.click(getByText('Open'))
    expect(queryByRole('dialog')).toBeNull()
  })

  it('focuses the panel on open and restores focus to the trigger on close', async () => {
    const { getByText, queryByRole } = render(() => (
      <IrisPopover>
        <IrisPopoverTrigger>Open</IrisPopoverTrigger>
        <IrisPopoverContent portalTarget={false}>Content</IrisPopoverContent>
      </IrisPopover>
    ))
    const trigger = getByText('Open')
    fireEvent.click(trigger)
    const panel = queryByRole('dialog')!
    await Promise.resolve()
    expect(document.activeElement).toBe(panel)
    fireEvent.click(trigger)
    expect(document.activeElement).toBe(trigger)
  })
})
