<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import type { IrisAvatarProps, IrisAvatarSize } from './types'

  const SIZE_MAP: Record<Exclude<IrisAvatarSize, number>, number> = { sm: 24, md: 32, lg: 48 }
  const resolveSize = (size: IrisAvatarSize): number =>
    typeof size === 'number' ? size : SIZE_MAP[size]

  function initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return ''
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }

  let {
    src = '',
    alt = '',
    name = '',
    fallback = '',
    fallbackContent,
    size = 'md',
    shape = 'circle',
    style,
    ...rest
  }: IrisAvatarProps = $props()

  let failed = $state(false)
  const px = $derived(resolveSize(size))
  const showImage = $derived(Boolean(src) && !failed)
  const initials = $derived(fallback || (name ? initialsFromName(name) : ''))

  const rootStyle = $derived(
    styleToString({
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: `${px}px`,
      height: `${px}px`,
      'border-radius': shape === 'circle' ? '50%' : 'var(--iris-radius-sm, 4px)',
      background: 'var(--iris-surface)',
      color: 'var(--iris-foreground)',
      'font-size': `${Math.max(10, Math.round(px * 0.4))}px`,
      'font-weight': 600,
      'line-height': 1,
      overflow: 'hidden',
      'user-select': 'none',
      'vertical-align': 'middle',
    }),
  )
</script>

<span
  {...rest}
  data-iris-avatar
  data-iris-avatar-shape={shape}
  data-iris-avatar-state={showImage ? 'image' : 'fallback'}
  style={mergeStyle(rootStyle, style)}
>
  {#if showImage}
    <img
      {src}
      {alt}
      data-iris-avatar-img
      style="width: 100%; height: 100%; object-fit: cover; display: block"
      onerror={() => (failed = true)}
    />
  {:else if fallbackContent}{@render fallbackContent()}{:else}{initials}{/if}
</span>
