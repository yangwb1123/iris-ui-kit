import { createStore, type Store } from './store'

/**
 * Framework-agnostic internationalization engine. Owns the active locale, a
 * message dictionary with `{placeholder}` interpolation, and Intl-based
 * date/number/relative-time formatting. Like the form engine, the React/Vue
 * adapters are thin providers over the `Store<I18nState>` exposed here, so the
 * same locale state drives components on either framework.
 */

export type I18nMessages = Record<string, string>

export interface I18nConfig {
  /** BCP-47 locale tag. Defaults to `en-US`. */
  locale?: string
  /** Message overrides merged on top of {@link defaultMessages}. */
  messages?: I18nMessages
}

export interface I18nState {
  locale: string
  /** User-provided overrides only; built-ins live in {@link defaultMessages}. */
  messages: I18nMessages
}

export interface I18n {
  store: Store<I18nState>
  getState(): I18nState
  subscribe(listener: (state: I18nState) => void): () => void
  /**
   * Translate a key, interpolating `{name}` placeholders from `params`.
   * Resolution order: override messages → {@link defaultMessages} → the key
   * itself (so a missing key is visible rather than blank).
   */
  t(key: string, params?: Record<string, string | number>): string
  setLocale(locale: string): void
  setMessages(messages: I18nMessages): void
  formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string
  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
  ): string
}

/**
 * Built-in English copy for component-facing strings. Components should read
 * these via `t(...)` so consumers can localize by passing `messages` overrides
 * (or calling `setMessages`) instead of forking the component.
 */
export const defaultMessages: I18nMessages = {
  'pagination.label': 'Pagination',
  'pagination.previous': 'Previous page',
  'pagination.next': 'Next page',
  'pagination.first': 'First page',
  'pagination.last': 'Last page',
  'pagination.page': 'Page {page}',
  'dialog.close': 'Close',
  'drawer.close': 'Close',
  'select.placeholder': 'Select…',
  'commandPalette.placeholder': 'Type a command…',
  'commandPalette.empty': 'No results',
  'fileUpload.label': 'Click or drop files to upload',
  'otpInput.cell': 'Character {index} of {total}',
  'rating.value': '{value} of {max}',
  'combobox.empty': 'No results',
  'carousel.previous': 'Previous slide',
  'carousel.next': 'Next slide',
  'carousel.slide': 'Slide {index} of {total}',
  'transfer.toTarget': 'Move to selected',
  'transfer.toSource': 'Move to available',
  'transfer.search': 'Search',
  'transfer.empty': 'No items',
  'table.empty': 'No data',
  'table.loading': 'Loading…',
  'table.error': 'Failed to load data',
  'clearable.clear': 'Clear',
}

const DEFAULT_LOCALE = 'en-US'

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function createI18n(config: I18nConfig = {}): I18n {
  const store = createStore<I18nState>({
    locale: config.locale ?? DEFAULT_LOCALE,
    messages: { ...config.messages },
  })

  const resolve = (key: string): string => {
    const { messages } = store.getState()
    return messages[key] ?? defaultMessages[key] ?? key
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    t: (key, params) => interpolate(resolve(key), params),
    setLocale: (locale) => store.setState((s) => ({ ...s, locale })),
    setMessages: (messages) =>
      store.setState((s) => ({ ...s, messages: { ...s.messages, ...messages } })),
    formatDate: (value, options) =>
      new Intl.DateTimeFormat(store.getState().locale, options).format(value),
    formatNumber: (value, options) =>
      new Intl.NumberFormat(store.getState().locale, options).format(value),
    formatRelativeTime: (value, unit, options) =>
      new Intl.RelativeTimeFormat(store.getState().locale, options).format(value, unit),
  }
}
