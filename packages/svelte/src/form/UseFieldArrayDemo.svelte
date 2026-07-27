<script lang="ts">
  import type { FormStore, FormValues } from '@iris-ui-kit/core'
  import { createFormStore } from '@iris-ui-kit/core'
  import type { UseFieldArrayReturn } from './useFieldArray'
  import IrisForm from './IrisForm.svelte'
  import UseFieldArrayBody from './UseFieldArrayBody.svelte'

  interface Props {
    onready?: (api: UseFieldArrayReturn<{ name: string }>) => void
  }

  let { onready }: Props = $props()

  const form = createFormStore({
    initialValues: { items: [{ name: 'First' }, { name: 'Second' }] },
  })
</script>

<IrisForm form={form as unknown as FormStore<FormValues>}>
  <UseFieldArrayBody {onready} />
</IrisForm>
