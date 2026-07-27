import { defineEventHandler } from 'h3'
import { getTeamRows } from '../utils/team'

export default defineEventHandler(() => ({
  source: 'nuxt-server-api',
  generatedAt: new Date().toISOString(),
  rows: getTeamRows(),
}))
