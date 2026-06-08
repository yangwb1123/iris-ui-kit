import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisFileUpload } from './IrisFileUpload'

afterEach(cleanup)

describe('IrisFileUpload', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisFileUpload />)
    expect(container.querySelector('[data-iris-file-upload]')).not.toBeNull()
  })

  it('renders the drop zone', () => {
    const { container } = render(() => <IrisFileUpload />)
    expect(container.querySelector('[data-iris-file-upload-zone]')).not.toBeNull()
  })

  it('renders file list when files provided', () => {
    const files = [
      { file: new File([''], 'test.txt'), name: 'test.txt', size: 0, type: 'text/plain' },
    ]
    const { container } = render(() => <IrisFileUpload value={files} />)
    expect(container.querySelector('[data-iris-file-upload-list]')).not.toBeNull()
    expect(container.querySelector('[data-iris-file-upload-item]')).not.toBeNull()
  })

  it('renders label in zone', () => {
    const { container } = render(() => <IrisFileUpload label="Drop files here" />)
    const label = container.querySelector('[data-iris-file-upload-label]')
    expect(label?.textContent).toBe('Drop files here')
  })
})
