<script lang="ts">
  import type { FormStore, FormValues } from '@iris-ui-kit/core'
  import type { UseFieldArrayReturn } from './useFieldArray'
  import { setFormContext } from './context'
  import { useFieldArray } from './useFieldArray'

  interface Props {
    form: FormStore<FormValues>
    onready?: (api: UseFieldArrayReturn<{ name: string }>) => void
  }

  let { form, onready }: Props = $props()

  // svelte-ignore state_referenced_locally — form store is stable (createFormStore returns same ref)
  setFormContext(form)

  const arr = useFieldArray<{ name: string }>('items')

  // svelte-ignore state_referenced_locally — fixture: hand the controller out once.
  onready?.(arr)
</script>
