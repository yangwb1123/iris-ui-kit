export type IrisTimelineVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface IrisTimelineItem {
  key?: string | number
  title?: string
  description?: string
  time?: string
  variant?: IrisTimelineVariant
  color?: string
}
