import * as React from 'react'

export interface RadioGroupContextValue {
  name: string
  value: string | null
  setValue: (next: string) => void
  disabled: boolean
}

export const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null)
