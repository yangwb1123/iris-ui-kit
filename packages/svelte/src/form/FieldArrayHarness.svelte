<script lang="ts">
  import { untrack } from 'svelte'
  import type { FormStore, FormValues } from '@iris-ui-kit/core'
  import type { UseFieldArrayReturn } from './useFieldArray'
  import { setFormContext } from './context'
  import { useFieldArray } from './useFieldArray'

  interface Props {
    form: FormStore<FormValues>
    fieldName?: string
    onready?: (api: UseFieldArrayReturn<string>) => void
  }

  let { form, fieldName = 'items', onready }: Props = $props()

  // Context and field-array identity are construction-time inputs for this test
  // fixture; `untrack` makes that lifecycle explicit.
  setFormContext(untrack(() => form))

  const arr = useFieldArray<string>(untrack(() => fieldName))
  const { fields, push, remove, insert, move } = arr

  untrack(() => onready)?.(arr)
</script>

<ul role="list">
  {#each $fields as item, i (i)}
    <li data-testid="row">{item}</li>
  {/each}
</ul>
<button type="button" onclick={() => push('c')}>push</button>
<button type="button" onclick={() => remove(0)}>remove0</button>
<button type="button" onclick={() => insert(1, 'x')}>insert1</button>
<button type="button" onclick={() => move(0, 2)}>move</button>
