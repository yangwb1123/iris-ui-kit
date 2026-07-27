export interface TeamRow {
  id: number
  name: string
  role: string
  status: string
}

export function getTeamRows(): TeamRow[] {
  return [
    { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
    { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
    { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
  ]
}
