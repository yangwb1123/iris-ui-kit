import { getContext, setContext } from 'svelte'
import type { I18n } from '@iris-ui-kit/core'

const I18N_KEY = Symbol('IrisI18n')

export function setI18nContext(i18n: I18n): void {
  setContext(I18N_KEY, i18n)
}

export function getI18nContext(): I18n | null {
  return getContext<I18n | null>(I18N_KEY) ?? null
}
