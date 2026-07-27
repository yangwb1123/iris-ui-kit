interface FeedbackFields {
  name: string
  message: string
}

function validateFeedback(formData: FormData) {
  const fields: FeedbackFields = {
    name: String(formData.get('name') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
  }
  const errors: Partial<Record<keyof FeedbackFields, string>> = {}
  if (fields.name.length < 2) errors.name = 'Enter at least 2 characters.'
  if (fields.message.length < 10) errors.message = 'Enter at least 10 characters.'
  return { fields, errors }
}

export async function POST(request: Request) {
  const validation = validateFeedback(await request.formData())
  const invalidFields = Object.keys(validation.errors)
  const acceptsJson = request.headers.get('accept')?.includes('application/json') ?? false

  if (invalidFields.length > 0) {
    const result = {
      ok: false,
      message: 'Name and message are required.',
      errors: validation.errors,
    }
    if (acceptsJson) return Response.json(result, { status: 422 })

    const target = new URL('/feedback', request.url)
    target.searchParams.set('status', 'error')
    target.searchParams.set('fields', invalidFields.join(','))
    return Response.redirect(target, 303)
  }

  const result = {
    ok: true,
    message: `Thanks, ${validation.fields.name}. Your feedback was validated on the server.`,
  }
  if (acceptsJson) return Response.json(result)

  const target = new URL('/feedback?status=success', request.url)
  return Response.redirect(target, 303)
}
