import { action, query, redirect } from '@solidjs/router'

export interface TeamPayload {
  source: string
  generatedAt: string
  rows: Record<string, unknown>[]
}

export interface FeedbackResult {
  ok: boolean
  message: string
  errors?: Record<string, string>
}

export function validateFeedback(formData: FormData): FeedbackResult {
  const name = String(formData.get('name') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  const errors: Record<string, string> = {}

  if (name.length < 2) errors.name = 'Enter at least 2 characters.'
  if (message.length < 10) errors.message = 'Enter at least 10 characters.'

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: 'Name and message are required.', errors }
  }
  return {
    ok: true,
    message: `Thanks, ${name}. Your feedback was validated on the server.`,
  }
}

export const getTeam = query(async (): Promise<TeamPayload> => {
  'use server'

  return {
    source: 'solidstart-query',
    generatedAt: new Date().toISOString(),
    rows: [
      { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
      { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
      { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
    ],
  }
}, 'solidstart-team')

export const submitFeedback = action(async (formData: FormData): Promise<FeedbackResult> => {
  'use server'

  const result = validateFeedback(formData)
  const params = new URLSearchParams({ status: result.ok ? 'success' : 'error' })
  const name = String(formData.get('name') ?? '').trim()
  if (name) params.set('name', name)
  if (result.errors) params.set('fields', Object.keys(result.errors).join(','))

  throw redirect(`/feedback?${params.toString()}`, 303)
}, 'solidstart-feedback')
