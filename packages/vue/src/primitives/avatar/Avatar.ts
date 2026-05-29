import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'

export type IrisAvatarShape = 'circle' | 'square'
export type IrisAvatarSize = 'sm' | 'md' | 'lg' | number

const SIZE_MAP: Record<Exclude<IrisAvatarSize, number>, number> = {
  sm: 24,
  md: 32,
  lg: 48,
}

function resolveSize(size: IrisAvatarSize): number {
  return typeof size === 'number' ? size : SIZE_MAP[size]
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/**
 * User profile picture with graceful fallback.
 *
 * Behavior:
 *   - When `src` is provided, renders an `<img>`. If the image fails to load
 *     (404, CORS, etc.) we swap to the fallback.
 *   - When no `src` is provided, or after failure, render `fallback` (or
 *     auto-derived initials from `name`).
 *   - Default size 32px (`md`); pass any number for a custom pixel size.
 */
export const IrisAvatar = defineComponent({
  name: 'IrisAvatar',
  inheritAttrs: false,
  props: {
    src: { type: String, default: '' },
    alt: { type: String, default: '' },
    /** Name used to auto-derive initials when no fallback slot is supplied. */
    name: { type: String, default: '' },
    /** Explicit fallback string. Takes precedence over derived initials. */
    fallback: { type: String, default: '' },
    size: { type: [String, Number] as PropType<IrisAvatarSize>, default: 'md' },
    shape: { type: String as PropType<IrisAvatarShape>, default: 'circle' },
  },
  setup(props, { slots, attrs }) {
    const failed = ref(false)

    watch(
      () => props.src,
      () => {
        failed.value = false
      },
    )

    const px = computed(() => resolveSize(props.size))
    const showImage = computed(() => Boolean(props.src) && !failed.value)
    const fallbackText = computed(
      () => props.fallback || (props.name ? initialsFromName(props.name) : ''),
    )

    const containerStyle = computed<Record<string, string>>(() => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${px.value}px`,
      height: `${px.value}px`,
      borderRadius: props.shape === 'circle' ? '50%' : 'var(--iris-radius-sm, 4px)',
      background: 'var(--iris-surface)',
      color: 'var(--iris-foreground)',
      fontSize: `${Math.max(10, Math.round(px.value * 0.4))}px`,
      fontWeight: '600',
      lineHeight: '1',
      overflow: 'hidden',
      userSelect: 'none',
      verticalAlign: 'middle',
    }))

    return () => {
      const baseAttrs = {
        ...attrs,
        'data-iris-avatar': '',
        'data-iris-avatar-shape': props.shape,
        'data-iris-avatar-state': showImage.value ? 'image' : 'fallback',
        style: { ...containerStyle.value, ...((attrs.style as Record<string, string>) ?? {}) },
      }

      if (showImage.value) {
        return h('span', baseAttrs, [
          h('img', {
            src: props.src,
            alt: props.alt,
            'data-iris-avatar-img': '',
            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
            onError: () => {
              failed.value = true
            },
          }),
        ])
      }

      const fallbackContent = slots.fallback?.() ?? fallbackText.value ?? ''

      return h('span', baseAttrs, fallbackContent)
    }
  },
})
