<script lang="ts">
  import { IrisForm, useForm } from './form'
  import type { FormStore, FormValues } from '@iris-ui-kit/core'

  const form = useForm({
    initialValues: { name: '' },
    validators: { name: (v: string) => (v ? undefined : 'Required') },
  })
  const store = form.form as unknown as FormStore<FormValues>
  const state = $state(store.getState())

  store.subscribe((s) => {
    Object.assign(state, s)
  })

  function onInput(e: Event) {
    store.setFieldValue('name', (e.target as HTMLInputElement).value)
  }
</script>

<IrisForm form={store}>
  <div data-iris-form-field="">
    <input
      aria-label="name"
      data-iris-input=""
      value={state.values.name as string}
      oninput={onInput}
    />
    {#if state.errors.name}
      <span data-iris-form-error="">{state.errors.name}</span>
    {/if}
  </div>
</IrisForm>
