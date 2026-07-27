export interface FeedbackFields {
  name: string
  message: string
}

export interface FeedbackValidation {
  fields: FeedbackFields
  errors: Record<string, string>
}

export function validateFeedback(formData: FormData): FeedbackValidation {
  const fields = {
    name: String(formData.get('name') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
  }
  const errors: Record<string, string> = {}

  if (fields.name.length < 2) errors.name = 'Enter at least 2 characters.'
  if (fields.message.length < 10) errors.message = 'Enter at least 10 characters.'

  return { fields, errors }
}
