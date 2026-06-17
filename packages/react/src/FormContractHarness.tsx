import { IrisForm } from './form/Form'
import { useForm } from './form/useForm'
import { useField } from './form/useField'

function NameField() {
  const field = useField<string>('name')
  return (
    <div data-iris-form-field="">
      <input aria-label="name" {...field.inputProps} data-iris-input="" />
      {field.error ? <span data-iris-form-error="">{field.error}</span> : null}
    </div>
  )
}

export function FormContractHarness() {
  const form = useForm({
    initialValues: { name: '' },
    validators: { name: (v) => (v ? undefined : 'Required') },
  })
  return (
    <IrisForm form={form.form}>
      <NameField />
    </IrisForm>
  )
}
