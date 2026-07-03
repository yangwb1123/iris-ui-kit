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

  it('wires trigger<->panel via aria-controls / aria-labelledby', () => {
    const { container } = render(() => <BasicTabs />)
    const trigger = container.querySelector('[data-iris-tabs-trigger][data-value="a"]')!
    const panel = container.querySelector('[data-iris-tabs-content][data-value="a"]')!
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(trigger.id).toBeTruthy()
    expect(panel.id).toBeTruthy()
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

  describe('keyboard navigation', () => {
    it('ArrowRight moves to the next tab (horizontal)', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisTabs defaultValue="a" onChange={onChange}>
          <IrisTabsList>
            <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
            <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="a">Content A</IrisTabsContent>
          <IrisTabsContent value="b">Content B</IrisTabsContent>
        </IrisTabs>
      ))
      const triggerA = container.querySelector('[data-value="a"]') as HTMLButtonElement
      fireEvent.keyDown(triggerA, { key: 'ArrowRight' })
      expect(onChange).toHaveBeenCalledWith('b')
    })

    it('ArrowLeft moves to the previous tab (horizontal)', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisTabs defaultValue="b" onChange={onChange}>
          <IrisTabsList>
            <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
            <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="a">Content A</IrisTabsContent>
          <IrisTabsContent value="b">Content B</IrisTabsContent>
        </IrisTabs>
      ))
      const triggerB = container.querySelector('[data-value="b"]') as HTMLButtonElement
      fireEvent.keyDown(triggerB, { key: 'ArrowLeft' })
      expect(onChange).toHaveBeenCalledWith('a')
    })

    it('Home moves to the first tab', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisTabs defaultValue="b" onChange={onChange}>
          <IrisTabsList>
            <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
            <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="a">Content A</IrisTabsContent>
          <IrisTabsContent value="b">Content B</IrisTabsContent>
        </IrisTabs>
      ))
      const triggerB = container.querySelector('[data-value="b"]') as HTMLButtonElement
      fireEvent.keyDown(triggerB, { key: 'Home' })
      expect(onChange).toHaveBeenCalledWith('a')
    })

    it('End moves to the last tab', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisTabs defaultValue="a" onChange={onChange}>
          <IrisTabsList>
            <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
            <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="a">Content A</IrisTabsContent>
          <IrisTabsContent value="b">Content B</IrisTabsContent>
        </IrisTabs>
      ))
      const triggerA = container.querySelector('[data-value="a"]') as HTMLButtonElement
      fireEvent.keyDown(triggerA, { key: 'End' })
      expect(onChange).toHaveBeenCalledWith('b')
    })

    it('ArrowDown moves to the next tab (vertical)', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisTabs defaultValue="a" orientation="vertical" onChange={onChange}>
          <IrisTabsList>
            <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
            <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="a">Content A</IrisTabsContent>
          <IrisTabsContent value="b">Content B</IrisTabsContent>
        </IrisTabs>
      ))
      const triggerA = container.querySelector('[data-value="a"]') as HTMLButtonElement
      fireEvent.keyDown(triggerA, { key: 'ArrowDown' })
      expect(onChange).toHaveBeenCalledWith('b')
    })

    it('ArrowUp moves to the previous tab (vertical)', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisTabs defaultValue="b" orientation="vertical" onChange={onChange}>
          <IrisTabsList>
            <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
            <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="a">Content A</IrisTabsContent>
          <IrisTabsContent value="b">Content B</IrisTabsContent>
        </IrisTabs>
      ))
      const triggerB = container.querySelector('[data-value="b"]') as HTMLButtonElement
      fireEvent.keyDown(triggerB, { key: 'ArrowUp' })
      expect(onChange).toHaveBeenCalledWith('a')
    })
  })
})
