import { defineEventHandler, getHeader, readFormData, sendRedirect, setResponseStatus } from 'h3'
import { validateFeedback } from '../utils/feedback'

export default defineEventHandler(async (event) => {
  const validation = validateFeedback(await readFormData(event))
  const hasErrors = Object.keys(validation.errors).length > 0
  const acceptsJson = getHeader(event, 'accept')?.includes('application/json') ?? false

  if (hasErrors) {
    const result = {
      ok: false,
      message: 'Name and message are required.',
      errors: validation.errors,
    }
    if (acceptsJson) {
      setResponseStatus(event, 422)
      return result
    }
    return sendRedirect(
      event,
      `/feedback?status=error&message=${encodeURIComponent(result.message)}`,
      303,
    )
  }

  const result = {
    ok: true,
    message: `Thanks, ${validation.fields.name}. Your feedback was validated on the server.`,
  }
  if (acceptsJson) return result
  return sendRedirect(event, '/feedback?status=success', 303)
})
