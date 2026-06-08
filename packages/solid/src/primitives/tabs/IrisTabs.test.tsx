import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTabs, IrisTabsList, IrisTabsTrigger, IrisTabsContent } from './IrisTabs'

afterEach(cleanup)

const BasicTabs = () => (
  <IrisTabs defaultValue="a">
    <IrisTabsList>
      <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
      <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
    </IrisTabsList>
    <IrisTabsContent value="a">Content A</IrisTabsContent>
    <IrisTabsContent value="b">Content B</IrisTabsContent>
  </IrisTabs>
)

describe('IrisTabs', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <BasicTabs />)
    expect(container.querySelector('[data-iris-tabs-list]')).not.toBeNull()
  })

  it('shows the default tab content', () => {
    const { getByText } = render(() => <BasicTabs />)
    expect(getByText('Content A')).toBeTruthy()
  })

  it('switches content on trigger click', () => {
    const { getByText, container } = render(() => <BasicTabs />)
    const triggerB = container.querySelector('[data-value="b"]') as HTMLButtonElement
    fireEvent.click(triggerB)
    expect(getByText('Content B')).toBeTruthy()
    // Content A should now be hidden
    const contentA = container.querySelector('[data-iris-tabs-content][data-value="a"]')
    expect(contentA?.getAttribute('hidden')).not.toBeNull()
  })

  it('calls onChange when trigger clicked', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTabs defaultValue="a" onChange={onChange}>
        <IrisTabsList>
          <IrisTabsTrigger value="a">A</IrisTabsTrigger>
          <IrisTabsTrigger value="b">B</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="a">A</IrisTabsContent>
        <IrisTabsContent value="b">B</IrisTabsContent>
      </IrisTabs>
    ))
    const triggerB = container.querySelector('[data-value="b"]') as HTMLButtonElement
    fireEvent.click(triggerB)
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
