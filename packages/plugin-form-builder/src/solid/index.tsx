import { type JSX } from 'solid-js'
import { createFormBuilder, type FormBuilderConfig, type FormSchema } from '../core'
import { FormBuilderView } from './form-view'

export type { FormSchema, FieldSpec } from '../core'

export interface IrisFormBuilderProps extends FormBuilderConfig {
  schema: FormSchema
  class?: string
  style?: JSX.CSSProperties
}

/** Render a validated schema-driven form over the shared core form engine. */
export function IrisFormBuilder(props: IrisFormBuilderProps): JSX.Element {
  const builder = createFormBuilder(props.schema, {
    onSubmit: props.onSubmit,
    validateOnChange: props.validateOnChange,
    parse: props.parse,
    transform: props.transform,
    dependencies: props.dependencies,
  })
  return <FormBuilderView builder={builder} class={props.class} style={props.style} />
}
