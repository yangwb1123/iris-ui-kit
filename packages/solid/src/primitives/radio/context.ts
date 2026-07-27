import { createContext, useContext } from 'solid-js'
import type { Size } from '@iris-ui-kit/core'

export type IrisRadioSize = Size

export interface RadioGroupContext {
  name: string
  value: () => string | number | boolean | null
  setValue: (value: string | number | boolean) => void
  size: () => IrisRadioSize
  disabled: () => boolean
}

export const RadioGroupCtx = createContext<RadioGroupContext>()

export function useRadioGroupContext(): RadioGroupContext | undefined {
  return useContext(RadioGroupCtx)
}
