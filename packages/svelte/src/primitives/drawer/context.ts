import { getContext, setContext } from 'svelte'

export type IrisDrawerSide = 'left' | 'right' | 'top' | 'bottom'

export const DRAWER_KEY = Symbol('iris-ui:drawer')

export interface DrawerContextValue {
  readonly open: boolean
  setOpen: (next: boolean) => void
  readonly trigger: HTMLElement | undefined
  setTrigger: (el: HTMLElement | undefined) => void
  readonly content: HTMLElement | undefined
  setContent: (el: HTMLElement | undefined) => void
  contentId: string
  titleId: string
  /** True while at least one IrisDrawerTitle is mounted. */
  readonly hasTitle: boolean
  /** Register a mounted title; returns a cleanup to call on unmount. */
  registerTitle: () => () => void
  readonly side: IrisDrawerSide
  readonly size: string
  readonly closeOnOutsideClick: boolean
  readonly closeOnEscape: boolean
}

export function setDrawerContext(value: DrawerContextValue): void {
  setContext(DRAWER_KEY, value)
}

export function getDrawerContext(componentName: string): DrawerContextValue {
  const ctx = getContext<DrawerContextValue | undefined>(DRAWER_KEY)
  if (!ctx) throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisDrawer>`)
  return ctx
}
