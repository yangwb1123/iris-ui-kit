import * as React from 'react'
import { nextEnabledIndex } from '@iris-ui-kit/core'
import { TabsContext, type IrisTabsOrientation } from './context'

export interface IrisTabsProps {
  /** Controlled active value. */
  value?: string
  /** Initial active value in uncontrolled mode. */
  defaultValue?: string
  onValueChange?: (next: string) => void
  orientation?: IrisTabsOrientation
  disabled?: boolean
  /** When true (default), content panels are unmounted when not active. */
  lazy?: boolean
  children?: React.ReactNode
}

interface TriggerRegistration {
  value: string
  isDisabled: () => boolean
}

/**
 * Tabs root. Provides context for value, orientation, lazy mounting, and the
 * ordered set of registered triggers so arrow-key navigation can move focus
 * deterministically (skipping disabled triggers).
 *
 * @example
 *   <IrisTabs defaultValue="a">
 *     <IrisTabsList>
 *       <IrisTabsTrigger value="a">First</IrisTabsTrigger>
 *       <IrisTabsTrigger value="b">Second</IrisTabsTrigger>
 *     </IrisTabsList>
 *     <IrisTabsContent value="a">Panel A</IrisTabsContent>
 *     <IrisTabsContent value="b">Panel B</IrisTabsContent>
 *   </IrisTabs>
 */
export function IrisTabs({
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  disabled = false,
  lazy = true,
  children,
}: IrisTabsProps): React.ReactElement {
  const isControlled = valueProp !== undefined
  const [internalValue, setInternalValue] = React.useState<string | null>(defaultValue ?? null)

  const effectiveValue = isControlled ? valueProp : internalValue

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next)
      onValueChange?.(next)
    },
    [isControlled, onValueChange],
  )

  // Ordered trigger registry, kept in a ref so registration doesn't churn
  // the render. Reads happen at event time (moveFocus), not render time.
  const triggersRef = React.useRef<TriggerRegistration[]>([])
  const listRef = React.useRef<HTMLElement | null>(null)

  const focusTriggerByValue = React.useCallback((value: string) => {
    const root = listRef.current
    if (!root) return
    const el = root.querySelector<HTMLElement>(`[data-iris-tabs-trigger][data-value="${value}"]`)
    el?.focus()
  }, [])

  const registerTrigger = React.useCallback(
    (value: string, isDisabled: () => boolean) => {
      if (triggersRef.current.some((t) => t.value === value)) {
        // Already registered; return a no-op unregister.
        return () => {}
      }
      triggersRef.current = [...triggersRef.current, { value, isDisabled }]
      // First registered trigger becomes default focus target if none set.
      if (!isControlled) {
        setInternalValue((cur) => {
          if (cur === null && !isDisabled()) return value
          return cur
        })
      }
      return () => {
        triggersRef.current = triggersRef.current.filter((t) => t.value !== value)
      }
    },
    [isControlled],
  )

  const moveFocus = React.useCallback(
    (from: string, delta: 1 | -1 | 'home' | 'end') => {
      const enabled = triggersRef.current.filter((t) => !t.isDisabled())
      if (enabled.length === 0) return
      const fromIndex = enabled.findIndex((t) => t.value === from)
      let nextIndex: number
      if (delta === 'home') nextIndex = 0
      else if (delta === 'end') nextIndex = enabled.length - 1
      // Step ±1 over the already-enabled list (wrap) via the shared core helper.
      else nextIndex = nextEnabledIndex(fromIndex, delta, enabled.length)
      const next = enabled[nextIndex]
      if (next) {
        setValue(next.value)
        focusTriggerByValue(next.value)
      }
    },
    [setValue, focusTriggerByValue],
  )

  const value = React.useMemo(
    () => ({
      value: effectiveValue,
      setValue,
      orientation,
      disabled,
      lazy,
      registerTrigger,
      moveFocus,
      listRef,
    }),
    [effectiveValue, setValue, orientation, disabled, lazy, registerTrigger, moveFocus],
  )

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}
