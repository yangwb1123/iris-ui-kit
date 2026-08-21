<script lang="ts">
  let {
    role,
    header = false,
    style,
  }: {
    role: 'columnheader' | 'cell'
    header?: boolean
    style: string
  } = $props()
</script>

<div
  {role}
  data-iris-table-header={header ? '__drag' : undefined}
  data-iris-table-cell={header ? undefined : '__drag'}
  {style}
></div>
