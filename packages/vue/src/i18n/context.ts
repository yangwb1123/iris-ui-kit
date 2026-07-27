import { type InjectionKey } from 'vue'
import type { I18n } from '@iris-ui-kit/core'

/** Injection key carrying the active {@link I18n} instance to `useI18n`. */
export const I18nInjectionKey: InjectionKey<I18n> = Symbol('IrisI18n')
