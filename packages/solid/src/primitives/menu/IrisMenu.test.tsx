import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisMenu } from './IrisMenu'
import { IrisMenuTrigger } from './IrisMenuTrigger'
import { IrisMenuContent } from './IrisMenuContent'
import { IrisMenuItem } from './IrisMenuItem'

afterEach(cleanup)

describe('IrisMenu', () => {
  it('renders trigger without crashing', () => {
    const { getByText } = render(() => (
      <IrisMenu>
        <IrisMenuTrigger>Menu</IrisMenuTrigger>
        <IrisMenuContent portalTarget={false}>
          <IrisMenuItem>Item 1</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>
    ))
    expect(getByText('Menu')).toBeTruthy()
  })

  it('shows menu content on trigger click', () => {
    const { getByText } = render(() => (
      <IrisMenu>
        <IrisMenuTrigger>Open Menu</IrisMenuTrigger>
        <IrisMenuContent portalTarget={false}>
          <IrisMenuItem>Item 1</IrisMenuItem>
          <IrisMenuItem>Item 2</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>
    ))
    expect(document.querySelector('[role=menu]')).toBeNull()
    fireEvent.click(getByText('Open Menu'))
    expect(document.querySelector('[role=menu]')).not.toBeNull()
    expect(getByText('Item 1')).toBeTruthy()
    expect(getByText('Item 2')).toBeTruthy()
  })

  it('closes menu when IrisMenuItem is clicked', () => {
    const { getByText } = render(() => (
      <IrisMenu>
        <IrisMenuTrigger>Open</IrisMenuTrigger>
        <IrisMenuContent portalTarget={false}>
          <IrisMenuItem>Action</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>
    ))
    fireEvent.click(getByText('Open'))
    expect(document.querySelector('[role=menu]')).not.toBeNull()
    fireEvent.click(getByText('Action'))
    expect(document.querySelector('[role=menu]')).toBeNull()
  })
})
