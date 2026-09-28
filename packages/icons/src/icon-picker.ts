/**
 * Framework-agnostic category and search helpers for IrisIconPicker. IconPicker
 * stores/selects semantic names; rendering remains the adapter's IrisIcon, so
 * custom icon sets still flow through the structured-node safety boundary.
 */
export interface IrisIconPickerCategory {
  /** Stable id used for filtering and localization (`iconPicker.category.<id>`). */
  id: string
  /** Optional consumer-provided label; otherwise the adapter uses i18n. */
  label?: string
  /** Semantic icon names in this category. Unlisted icons appear in `other`. */
  iconNames: readonly string[]
}

export const defaultIconPickerCategories: readonly IrisIconPickerCategory[] = [
  {
    id: 'navigation',
    iconNames: [
      'arrow-up',
      'arrow-down',
      'arrow-left',
      'arrow-right',
      'chevron-up',
      'chevron-down',
      'chevron-left',
      'chevron-right',
      'chevrons-up',
      'chevrons-down',
      'chevrons-left',
      'chevrons-right',
      'home',
      'menu',
      'more-horizontal',
      'more-vertical',
      'sidebar',
      'external-link',
      'maximize',
      'minimize',
    ],
  },
  {
    id: 'actions',
    iconNames: [
      'check',
      'x',
      'close',
      'plus',
      'minus',
      'edit',
      'copy',
      'save',
      'trash',
      'share',
      'refresh',
      'download',
      'upload',
      'filter',
      'sort-asc',
      'sort-desc',
    ],
  },
  {
    id: 'status',
    iconNames: [
      'alert-triangle',
      'alert-circle',
      'check-circle',
      'info',
      'help-circle',
      'slash',
      'loader',
    ],
  },
  {
    id: 'files',
    iconNames: ['file', 'folder', 'image', 'camera', 'paperclip', 'printer', 'tag', 'gift'],
  },
  {
    id: 'communication',
    iconNames: ['bell', 'bell-off', 'mail', 'send', 'inbox', 'phone'],
  },
  { id: 'people', iconNames: ['user', 'users'] },
  { id: 'security', iconNames: ['lock', 'unlock', 'shield', 'shield-off'] },
  { id: 'time', iconNames: ['calendar', 'clock'] },
  {
    id: 'display',
    iconNames: [
      'globe',
      'map-pin',
      'sun',
      'moon',
      'eye',
      'eye-off',
      'star',
      'heart',
      'thumbs-up',
      'thumbs-down',
      'grid',
      'list',
    ],
  },
]

/** Return the first declared category containing `name`, or `other`. */
export function getIconPickerCategoryId(
  name: string,
  categories: readonly IrisIconPickerCategory[] = defaultIconPickerCategories,
): string {
  return categories.find((category) => category.iconNames.includes(name))?.id ?? 'other'
}

/** Accent-insensitive, case-insensitive semantic-name search. */
export function matchesIconPickerQuery(name: string, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/-/g, ' ')
      .trim()
      .toLocaleLowerCase()
  const needle = normalize(query)
  return needle.length === 0 || normalize(name).includes(needle)
}
