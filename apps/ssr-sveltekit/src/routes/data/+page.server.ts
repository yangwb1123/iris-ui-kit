import type { PageServerLoad } from './$types'

export const load = (() => ({
  source: 'sveltekit-page-server-load',
  generatedAt: new Date().toISOString(),
  rows: [
    { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
    { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
    { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
  ],
})) satisfies PageServerLoad
