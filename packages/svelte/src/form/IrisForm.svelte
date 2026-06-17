<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { FormStore, FormValues } from '@iris-ui/core'
  import { setFormContext } from './context'

  interface Props {
    form: FormStore<FormValues>
    children?: Snippet
  }

  let { form, children }: Props = $props()

  // svelte-ignore state_referenced_locally — form store is stable (createFormStore returns same ref)
  setFormContext(form)

  let formEl = $state<HTMLFormElement | undefined>(undefined)

  function focusFirstError() {
    if (!formEl) return
    const errors = form.getState().errors
    const keys = Object.keys(errors)
    if (keys.length === 0) return
    const controls = formEl.querySelectorAll<HTMLElement>(
      'input[name], select[name], textarea[name], [data-iris-field]',
    )
    for (const el of Array.from(controls)) {
      const name = el.getAttribute('name') ?? el.getAttribute('data-iris-field')
      if (name && keys.includes(name)) {
        el.focus()
        try {
          el.scrollIntoView({ block: 'center' })
        } catch {
          /* jsdom */
        }
        return
      }
    }
  }

  function onSubmit(e: Event) {
    e.preventDefault()
    void form.handleSubmit().then(() => focusFirstError())
  }
</script>

<form bind:this={formEl} data-iris-form onsubmit={onSubmit}>
  {@render children?.()}
</form>
