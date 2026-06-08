<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  let {
    title = '',
    description = '',
    style,
    children,
    icon,
    titleSlot,
    descriptionSlot,
    action,
    ...rest
  } = $props()

  const containerStyle = styleToString({
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '12px',
    padding: '32px 16px',
    'text-align': 'center',
    color: 'var(--iris-foreground)',
  })
</script>

<div
  {...rest}
  role="status"
  data-iris-empty-state
  style={mergeStyle(containerStyle, style)}
>
  {#if icon}
    <div
      data-iris-empty-state-icon
      style="color: var(--iris-muted); font-size: 32px; line-height: 1"
    >
      {@render icon()}
    </div>
  {/if}
  {#if title || titleSlot}
    <div data-iris-empty-state-title style="font-weight: 600; font-size: 16px">
      {#if titleSlot}
        {@render titleSlot()}
      {:else}
        {title}
      {/if}
    </div>
  {/if}
  {#if description || descriptionSlot}
    <div
      data-iris-empty-state-description
      style="color: var(--iris-muted); font-size: 14px; max-width: 380px"
    >
      {#if descriptionSlot}
        {@render descriptionSlot()}
      {:else}
        {description}
      {/if}
    </div>
  {/if}
  {#if action}
    <div data-iris-empty-state-action style="margin-top: 4px">
      {@render action()}
    </div>
  {/if}
  {@render children?.()}
</div>
