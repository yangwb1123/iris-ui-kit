import { fail } from '@sveltejs/kit'
import { validateFeedback } from '$lib/server/feedback'
import type { Actions } from './$types'

export const actions = {
  default: async ({ request }) => {
    const validation = validateFeedback(await request.formData())

    if (Object.keys(validation.errors).length > 0) {
      return fail(400, {
        success: false,
        message: 'Name and message are required.',
        errors: validation.errors,
        values: validation.fields,
      })
    }

    return {
      success: true,
      message: `Thanks, ${validation.fields.name}. Your feedback was validated on the server.`,
      values: { name: validation.fields.name, message: '' },
    }
  },
} satisfies Actions
