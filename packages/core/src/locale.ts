/**
 * Pure locale-derived helpers (no DOM, no framework). Turn a BCP-47 locale into
 * the writing direction and the locale-default first day of week, so a consumer
 * can wire "set locale → flip `dir` / set `lang` / start the calendar on the
 * right day" instead of maintaining an RTL list by hand. `localeDirection` feeds
 * `@iris-ui-kit/theme`'s `applyDirection` (which owns the DOM write); the calendar
 * date helpers consume `localeWeekStartsOn`.
 */

// `Intl.Locale.prototype.textInfo` / `.weekInfo` are recent and shipped as a
// property in some engines and a `getTextInfo()` / `getWeekInfo()` method in
// others; model both shapes without `any`.
interface LocaleTextInfo {
  direction?: 'ltr' | 'rtl'
}
interface LocaleWeekInfo {
  firstDay?: number // 1 = Monday … 7 = Sunday (per the TC39 proposal)
}
type LocaleWithInfo = Intl.Locale & {
  textInfo?: LocaleTextInfo
  getTextInfo?: () => LocaleTextInfo
  weekInfo?: LocaleWeekInfo
  getWeekInfo?: () => LocaleWeekInfo
}

/** Language subtags written right-to-left (fallback when `textInfo` is absent). */
const RTL_LANGUAGES = new Set([
  'ar', // Arabic
  'he', // Hebrew
  'fa', // Persian
  'ur', // Urdu
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
  'yi', // Yiddish
  'dv', // Divehi
  'ku', // Kurdish (Sorani)
  'ckb', // Central Kurdish
  'syr', // Syriac
  'arc', // Aramaic
])

function primaryLanguage(locale: string): string {
  return locale.toLowerCase().split('-')[0] ?? ''
}

/**
 * Writing direction for a locale. Prefers the engine's `Intl.Locale` text info;
 * falls back to a known RTL-language list. Never throws — an unknown/invalid
 * locale resolves to `'ltr'`.
 */
export function localeDirection(locale: string): 'ltr' | 'rtl' {
  try {
    const loc = new Intl.Locale(locale) as LocaleWithInfo
    const info = loc.textInfo ?? loc.getTextInfo?.()
    if (info?.direction === 'rtl' || info?.direction === 'ltr') return info.direction
    return RTL_LANGUAGES.has(loc.language ?? primaryLanguage(locale)) ? 'rtl' : 'ltr'
  } catch {
    return RTL_LANGUAGES.has(primaryLanguage(locale)) ? 'rtl' : 'ltr'
  }
}

/** Convenience boolean mirror of {@link localeDirection}. */
export function isRtlLocale(locale: string): boolean {
  return localeDirection(locale) === 'rtl'
}

/**
 * Locale-default first day of week as a `0..6` index (0 = Sunday), matching the
 * calendar date helpers' `weekStartsOn`. Falls back to `0` (Sunday) when the
 * engine lacks `weekInfo` or the locale is invalid.
 */
export function localeWeekStartsOn(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as LocaleWithInfo
    const info = loc.weekInfo ?? loc.getWeekInfo?.()
    const firstDay = info?.firstDay
    // weekInfo.firstDay is 1 (Mon)..7 (Sun); map to 0 (Sun)..6 (Sat): 7 % 7 = 0.
    if (typeof firstDay === 'number' && firstDay >= 1 && firstDay <= 7) return firstDay % 7
    return 0
  } catch {
    return 0
  }
}
