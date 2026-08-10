<script lang="ts">
  import type { IrisTimelineItem, IrisTimelineVariant } from './types'

  type TimelineVariant = IrisTimelineVariant

  const VARIANT_COLOR: Record<TimelineVariant, string> = {
    default: 'var(--iris-primary)',
    success: 'var(--iris-success, #10b981)',
    warning: 'var(--iris-warning, #f59e0b)',
    danger: 'var(--iris-danger)',
    info: 'var(--iris-info, #0ea5e9)',
  }

  let {
    items = [],
    itemSnippet,
    style,
    ...rest
  }: {
    items?: IrisTimelineItem[]
    itemSnippet?: import('svelte').Snippet<[{ item: IrisTimelineItem; index: number }]>
    style?: string
    [key: string]: unknown
  } = $props()
</script>

<ol
  {...rest}
  data-iris-timeline
  style="list-style:none; margin:0; padding:0;{style ? ' ' + style : ''}"
>
  {#each items as item, i (item.key ?? i)}
    {@const isLast = i === items.length - 1}
    {@const variant = item.variant ?? 'default'}
    {@const dotColor = item.color ?? VARIANT_COLOR[variant]}
    <li
      data-iris-timeline-item
      data-variant={variant}
      style="display:flex; gap:12px; position:relative;"
    >
      <div
        data-iris-timeline-marker
        aria-hidden="true"
        style="display:flex; flex-direction:column; align-items:center; align-self:stretch;"
      >
        <span
          data-iris-timeline-dot
          style="width:12px; height:12px; border-radius:50%; background:{dotColor}; flex-shrink:0; margin-block-start:4px; box-shadow:0 0 0 3px var(--iris-background);"
        ></span>
        {#if !isLast}
          <span
            data-iris-timeline-line
            style="flex:1; width:2px; background:var(--iris-border); margin-block-start:4px;"
          ></span>
        {/if}
      </div>
      <div
        data-iris-timeline-content
        style="padding-block-end:{isLast ? '0' : '16px'}; min-width:0;"
      >
        {#if itemSnippet}
          {@render itemSnippet({ item, index: i })}
        {:else}
          {#if item.time != null}
            <div
              data-iris-timeline-time
              style="font-size:var(--iris-font-size-xs, 12px); color:var(--iris-muted);"
            >
              {item.time}
            </div>
          {/if}
          {#if item.title != null}
            <div data-iris-timeline-title style="font-weight:600; color:var(--iris-foreground);">
              {item.title}
            </div>
          {/if}
          {#if item.description != null}
            <div
              data-iris-timeline-desc
              style="font-size:var(--iris-font-size-md, 14px); color:var(--iris-foreground);"
            >
              {item.description}
            </div>
          {/if}
        {/if}
      </div>
    </li>
  {/each}
</ol>
