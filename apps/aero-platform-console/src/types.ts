export type JsonRecord = Record<string, unknown>

export interface PageData<T> {
  items: T[]
  nextCursor?: string
  partial?: boolean
  generatedAt?: string
  sourceErrors?: Record<string, string>
  staleDatasets?: string[]
}

export interface Profile {
  account_id?: string
  display_name?: string
  avatar_url?: string
  locale?: string
  timezone?: string
  preferences?: JsonRecord
}

export interface AccountView {
  account?: JsonRecord
  profile?: Profile
  sources?: JsonRecord[]
  memberships?: JsonRecord[]
}

export interface AggregateView {
  account?: JsonRecord
  profile?: Profile
  snapshots?: JsonRecord[]
  consistency?: string
  partial?: boolean
  source_errors?: Record<string, string>
  stale_datasets?: string[]
  generated_at?: string
}

export interface Dataset {
  name: string
  source: string
  pii: boolean
}

export interface SourceHealth {
  source: string
  status: 'ok' | 'degraded'
  error?: string
}

export type ConsistencyMode = 'eventual' | 'bounded' | 'strong'
