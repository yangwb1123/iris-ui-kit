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
   * Translate a key, interpolating `{name}` placeholders and ICU
   * `{count, plural, …}` blocks (locale-correct via `Intl.PluralRules`) from
   * `params`. Resolution order: override messages → {@link defaultMessages} →
   * the key itself (so a missing key is visible rather than blank).
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
  'alert.close': 'Close',
  'banner.close': 'Close',
  'chip.remove': 'Remove',
  'toast.dismiss': 'Dismiss',
  'select.placeholder': 'Select…',
  'select.options': 'Options',
  'select.empty': 'No options',
  'commandPalette.placeholder': 'Type a command…',
  'commandPalette.empty': 'No results',
  'commandPalette.label': 'Command palette',
  'commandPalette.search': 'Search commands',
  'commandPalette.commands': 'Commands',
  'fileUpload.label': 'Click or drop files to upload',
  'otpInput.cell': 'Character {index} of {total}',
  'rating.value': '{value} of {max}',
  'combobox.empty': 'No matching results',
  'carousel.previous': 'Previous slide',
  'carousel.next': 'Next slide',
  'carousel.slide': 'Slide {index} of {total}',
  'transfer.toTarget': 'Move to selected',
  'transfer.toSource': 'Move to available',
  'transfer.search': 'Search',
  'transfer.empty': 'No items to transfer',
  'backTop.label': 'Back to top',
  'treeSelect.expand': 'Expand',
  'treeSelect.collapse': 'Collapse',
  'image.preview': 'Image preview',
  'floatButton.actions': 'Actions',
  'tour.next': 'Next',
  'tour.prev': 'Previous',
  'tour.skip': 'Skip',
  'tour.finish': 'Finish',
  'tour.step': 'Step {current} of {total}',
  'tagInput.remove': 'Remove {tag}',
  'copyButton.copy': 'Copy',
  'copyButton.copied': 'Copied',
  'splitButton.more': 'More actions',
  'splitter.resize': 'Resize panels',
  'resizer.handle': 'Resize {handle}',
  'movable.roleDescription': 'movable',
  'table.selectAll': 'Select all',
  'table.selectedCount': '{count} selected',
  'table.resizeColumn': 'Resize {column}',
  'table.empty': 'No data to display',
  'table.loading': 'Loading…',
  'table.error': 'Failed to load data',
  'table.retry': 'Retry',
  'table.refresh': 'Refresh',
  'table.columnSettings': 'Column settings',
  'table.customConfig.search': 'Search columns',
  'table.customConfig.reset': 'Reset',
  'table.import': 'Import CSV',
  'table.export': 'Export',
  'table.formSubmit': 'Search',
  'table.formReset': 'Reset',
  'table.filterConfirm': 'Confirm',
  'table.filterClear': 'Clear',
  'table.filter': 'Filter',
  'table.total': 'Total {total}',
  'table.zoomIn': 'Zoom in',
  'table.zoomOut': 'Zoom out',
  'table.views.save': 'Save view',
  'table.views.placeholder': 'View name…',
  'table.views.delete': 'Delete view',
  'table.range.copy': 'Copy',
  'table.range.export': 'Export CSV',
  'table.range.clear': 'Clear',
  'table.range.toolbar': 'Cell range actions',
  'fnr.find': 'Find',
  'fnr.replace': 'Replace',
  'fnr.replaceAll': 'Replace all',
  'fnr.next': 'Next match',
  'fnr.prev': 'Previous match',
  'list.empty': 'No items to display',
  'list.loading': 'Loading…',
  'list.error': 'Failed to load',
  'tree.empty': 'No items to display',
  'tree.loading': 'Loading…',
  'tree.error': 'Failed to load',
  'clearable.clear': 'Clear',
  'calendar.previousMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'numberInput.decrement': 'Decrement',
  'numberInput.increment': 'Increment',
  'timePicker.hours': 'Hours',
  'timePicker.minutes': 'Minutes',
  'timePicker.togglePeriod': 'Toggle AM/PM',
  'colorPicker.hex': 'Hex',
  'colorPicker.hue': 'Hue',
  'colorPicker.saturationBrightness': 'Saturation and brightness',
  'colorPicker.saturationBrightnessValue': '{saturation}% saturation, {brightness}% brightness',
  'colorPicker.red': 'Red',
  'colorPicker.green': 'Green',
  'colorPicker.blue': 'Blue',
  'colorPicker.alpha': 'Alpha',
  'breadcrumb.label': 'Breadcrumb',
  'skeleton.loading': 'Loading',
  'passwordInput.show': 'Show password',
  'passwordInput.hide': 'Hide password',
  'datePicker.placeholder': 'Select date…',
  'dateRangePicker.placeholder': 'Select range…',
  'dateRangePicker.start': 'Start date',
  'dateRangePicker.end': 'End date',
  'transfer.sourceTitle': 'Available',
  'transfer.targetTitle': 'Selected',
  'transfer.selectAllSource': 'Select all available',
  'transfer.selectAllTarget': 'Select all selected',
  'table.selectRow': 'Select row {key}',
  'carousel.label': 'Carousel',
  'carousel.goTo': 'Go to slide {index}',
  'carousel.slides': 'Slides',
  'spinner.loading': 'Loading',
  'rating.label': 'Rating',
  'slider.label': 'Value',
  'rangeSlider.start': 'Start',
  'rangeSlider.end': 'End',
  'fileUpload.remove': 'Remove {name}',
  'timePicker.seconds': 'Seconds',
  'cascader.level': 'Level {level}',
  'tree.label': 'Tree',
  'errorBoundary.message': 'Something went wrong.',
  'errorBoundary.retry': 'Try again',
  'admin.openPages': 'Open pages',
  'admin.tabActions': 'Tab actions',
  'admin.refresh': 'Refresh',
  'admin.closeTab': 'Close {title}',
  'admin.close': 'Close',
  'admin.closeLeft': 'Close tabs to the left',
  'admin.closeRight': 'Close tabs to the right',
  'admin.closeOthers': 'Close others',
  'admin.closeAll': 'Close all',
  'admin.expandSidebar': 'Expand sidebar',
  'admin.collapseSidebar': 'Collapse sidebar',
  'admin.nav': 'Main navigation',
}

const DEFAULT_LOCALE = 'en-US'

/**
 * Return a BCP-47 tag the `Intl.*` constructors will accept, falling back to
 * {@link DEFAULT_LOCALE} when `locale` is structurally invalid. A malformed tag
 * (e.g. `'bad locale!'`, `'en_US'`) makes `new Intl.DateTimeFormat`,
 * `Intl.NumberFormat`, `Intl.RelativeTimeFormat`, and `Intl.PluralRules` throw
 * a `RangeError` — which would otherwise crash a render mid-format. Unknown but
 * well-formed tags (e.g. `'zz'`) pass through and Intl resolves them itself.
 * The stored locale is left untouched; only Intl formatting degrades.
 */
function safeLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

/** Index of the `}` that closes the `{` at `open` (balanced), or -1. */
function matchBrace(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === '{') depth += 1
    else if (s[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/** Parse an ICU plural body (`=0 {none} one {# item} other {# items}`) → cases. */
function parsePluralCases(body: string): Record<string, string> {
  const cases: Record<string, string> = {}
  let i = 0
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i]!)) i += 1
    let selector = ''
    while (i < body.length && !/\s/.test(body[i]!) && body[i] !== '{') {
      selector += body[i]
      i += 1
    }
    while (i < body.length && /\s/.test(body[i]!)) i += 1
    if (body[i] !== '{') break
    const end = matchBrace(body, i)
    if (end === -1) break
    if (selector) cases[selector] = body.slice(i + 1, end)
    i = end + 1
  }
  return cases
}

/**
 * Interpolate `{name}` placeholders AND a useful subset of ICU
 * `{count, plural, …}` (with `=N` exact cases + CLDR categories via
 * `Intl.PluralRules`, `#` → the value). Locale-aware so plural category
 * selection is correct per language. Plain `{name}` messages are unaffected.
 */
function interpolate(
  template: string,
  params?: Record<string, string | number>,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!params) return template
  let out = ''
  let i = 0
  while (i < template.length) {
    if (template[i] === '{') {
      const end = matchBrace(template, i)
      if (end === -1) {
        out += template[i]
        i += 1
        continue
      }
      const inner = template.slice(i + 1, end)
      const plural = /^(\w+)\s*,\s*plural\s*,(.*)$/s.exec(inner)
      if (plural) {
        const [, name, body] = plural
        const value = params[name!]
        if (typeof value === 'number') {
          const cases = parsePluralCases(body!)
          const text =
            cases[`=${value}`] ??
            cases[new Intl.PluralRules(safeLocale(locale)).select(value)] ??
            cases.other ??
            ''
          out += text.replace(/#/g, String(value))
        } else {
          out += `{${inner}}` // missing/non-numeric → leave visible
        }
      } else if (/^\w+$/.test(inner)) {
        const value = params[inner]
        out += value === undefined ? `{${inner}}` : String(value)
      } else {
        out += `{${inner}}`
      }
      i = end + 1
    } else {
      out += template[i]
      i += 1
    }
  }
  return out
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

  // Memoize Intl formatters by (locale, options). Constructing an `Intl.*Format`
  // is the expensive part (`.format()` is cheap); a date/number column over N
  // rows previously built N formatters per render. Formatters are pure for a
  // given key so the cache never needs invalidation; it is GC'd with this i18n
  // instance. A differing option key-order at worst causes a harmless cache miss.
  const dtfCache = new Map<string, Intl.DateTimeFormat>()
  const nfCache = new Map<string, Intl.NumberFormat>()
  const rtfCache = new Map<string, Intl.RelativeTimeFormat>()
  const cached = <F>(cache: Map<string, F>, locale: string, options: unknown, make: () => F): F => {
    const cacheKey = `${locale}|${JSON.stringify(options ?? {})}`
    let formatter = cache.get(cacheKey)
    if (formatter === undefined) {
      formatter = make()
      cache.set(cacheKey, formatter)
    }
    return formatter
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    t: (key, params) => interpolate(resolve(key), params, store.getState().locale),
    setLocale: (locale) => store.setState((s) => ({ ...s, locale })),
    setMessages: (messages) =>
      store.setState((s) => ({ ...s, messages: { ...s.messages, ...messages } })),
    formatDate: (value, options) => {
      const locale = safeLocale(store.getState().locale)
      return cached(
        dtfCache,
        locale,
        options,
        () => new Intl.DateTimeFormat(locale, options),
      ).format(value)
    },
    formatNumber: (value, options) => {
      const locale = safeLocale(store.getState().locale)
      return cached(nfCache, locale, options, () => new Intl.NumberFormat(locale, options)).format(
        value,
      )
    },
    formatRelativeTime: (value, unit, options) => {
      const locale = safeLocale(store.getState().locale)
      return cached(
        rtfCache,
        locale,
        options,
        () => new Intl.RelativeTimeFormat(locale, options),
      ).format(value, unit)
    },
  }
}
