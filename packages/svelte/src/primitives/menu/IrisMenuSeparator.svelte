<script lang="ts">
  interface Props {
    [key: string]: unknown
  }

  let { ...rest }: Props = $props()
</script>

<div
  {...rest}
  role="separator"
  data-iris-menu-separator
  style="height: 1px; background: var(--iris-border); margin: 4px 0;{(rest.style as string) ? ' ' + (rest.style as string) : ''}"
></div>
