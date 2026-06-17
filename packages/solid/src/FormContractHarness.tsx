import { IrisForm } from './form/IrisForm'
import { useForm } from './form/useForm'
import { useField } from './form/useField'

function NameField() {
  const field = useField<string>('name')
  return (
    <div data-iris-form-field="">
      <input
        aria-label="name"
        data-iris-input=""
        value={field.value() ?? ''}
        onInput={(e) => field.setValue((e.target as HTMLInputElement).value)}
        onBlur={() => field.setTouched(true)}
      />
      {field.error() && <span data-iris-form-error="">{field.error()}</span>}
    </div>
  )
}

export function FormContractHarness() {
  const form = useForm({
    initialValues: { name: '' },
    validators: { name: (v: string) => (v ? undefined : 'Required') },
  })
  return (
    <IrisForm form={form.form}>
      <NameField />
    </IrisForm>
  )
}
