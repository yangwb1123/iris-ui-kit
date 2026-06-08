import { getContext, setContext } from 'svelte'

export const RADIO_GROUP_KEY = Symbol('iris-ui:radio-group')

export type RadioSize = 'sm' | 'md' | 'lg'

export interface RadioGroupContextValue {
  readonly name: string
  readonly value: string | number | boolean | null
  readonly size: RadioSize
  readonly disabled: boolean
  setValue: (value: string | number | boolean) => void
}

export function setRadioGroupContext(value: RadioGroupContextValue): void {
  setContext(RADIO_GROUP_KEY, value)
}

export function getRadioGroupContext(): RadioGroupContextValue | undefined {
  return getContext<RadioGroupContextValue | undefined>(RADIO_GROUP_KEY)
}
