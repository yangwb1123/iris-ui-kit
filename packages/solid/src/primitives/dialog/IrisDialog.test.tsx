import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisDialog } from './IrisDialog'
import { IrisDialogTrigger } from './IrisDialogTrigger'
import { IrisDialogContent, IrisDialogTitle, IrisDialogClose } from './IrisDialogContent'

afterEach(cleanup)

describe('IrisDialog', () => {
  it('renders trigger without crashing', () => {
    const { getByText } = render(() => (
      <IrisDialog>
        <IrisDialogTrigger>Open Dialog</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false}>Dialog body</IrisDialogContent>
      </IrisDialog>
    ))
    expect(getByText('Open Dialog')).toBeTruthy()
  })

  it('opens dialog on trigger click (portal=false)', () => {
    const { getByText, queryByRole } = render(() => (
      <IrisDialog>
        <IrisDialogTrigger>Open</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false}>Content here</IrisDialogContent>
      </IrisDialog>
    ))
    expect(queryByRole('dialog')).toBeNull()
    fireEvent.click(getByText('Open'))
    expect(queryByRole('dialog')).not.toBeNull()
  })

  it('opens dialog with title (portal=false)', () => {
    const { getByText, queryByRole } = render(() => (
      <IrisDialog>
        <IrisDialogTrigger>Open</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false}>
          <IrisDialogTitle>My Dialog</IrisDialogTitle>
          Content here
        </IrisDialogContent>
      </IrisDialog>
    ))
    fireEvent.click(getByText('Open'))
    expect(queryByRole('dialog')).not.toBeNull()
    expect(getByText('My Dialog')).toBeTruthy()
  })

  it('closes dialog with IrisDialogClose (portal=false)', () => {
    const { getByText, queryByRole } = render(() => (
      <IrisDialog>
        <IrisDialogTrigger>Open</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false}>
          <IrisDialogClose>Close</IrisDialogClose>
        </IrisDialogContent>
      </IrisDialog>
    ))
    fireEvent.click(getByText('Open'))
    expect(queryByRole('dialog')).not.toBeNull()
    fireEvent.click(getByText('Close'))
    expect(queryByRole('dialog')).toBeNull()
  })

  it('supports controlled mode (portal=false)', () => {
    const { getByText, queryByRole } = render(() => (
      <IrisDialog open={true}>
        <IrisDialogContent portalTarget={false}>Controlled content</IrisDialogContent>
      </IrisDialog>
    ))
    expect(queryByRole('dialog')).not.toBeNull()
    expect(getByText('Controlled content')).toBeTruthy()
  })
})
