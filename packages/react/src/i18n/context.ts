import * as React from 'react'
import type { I18n } from '@iris-ui/core'

/** Carries the active {@link I18n} instance to descendants via `useI18n`. */
export const I18nContext = React.createContext<I18n | null>(null)
