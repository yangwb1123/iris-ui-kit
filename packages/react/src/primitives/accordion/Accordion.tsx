import * as React from 'react'
import { AccordionContext } from './context'

export type IrisAccordionValue = string | string[] | null

export interface IrisAccordionProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: IrisAccordionValue
  defaultValue?: IrisAccordionValue
  onValueChange?: (next: IrisAccordionValue) => void
  multiple?: boolean
  /** In single mode, allow zero items open. */
  collapsible?: boolean
}

/**
 * Container for collapsible sections.
 *
 *   - `multiple=false` (default): zero or one item open at a time. The value
 *     is `string | null`. Set `collapsible` to allow closing the active one.
 *   - `multiple=true`: any number of items open. Value is `string[]`.
 */
export function IrisAccordion({
  value: valueProp,
  defaultValue,
  onValueChange,
  multiple = false,
  collapsible = false,
  children,
  ...rest
}: IrisAccordionProps): React.ReactElement {
  const isControlled = valueProp !== undefined
  const initial: IrisAccordionValue =
    defaultValue !== undefined ? defaultValue : multiple ? [] : null
  const [internal, setInternal] = React.useState<IrisAccordionValue>(initial)

  const current = isControlled ? (valueProp as IrisAccordionValue) : internal

  const isOpen = React.useCallback(
    (v: string): boolean => {
      const c = current
      if (c === null || c === undefined) return false
      if (Array.isArray(c)) return c.includes(v)
      return c === v
    },
    [current],
  )

  // Hold the latest controlled value in a ref so toggle() always sees the
  // up-to-date source of truth even within a batched update.
  const controlledRef = React.useRef(valueProp)
  controlledRef.current = valueProp

  const toggle = React.useCallback(
    (v: string) => {
      const compute = (prev: IrisAccordionValue): IrisAccordionValue => {
        if (multiple) {
          const arr = Array.isArray(prev) ? prev : []
          const idx = arr.indexOf(v)
          return idx >= 0 ? arr.filter((x) => x !== v) : [...arr, v]
        }
        if (prev === v) return collapsible ? null : prev
        return v
      }
      if (isControlled) {
        const next = compute(controlledRef.current as IrisAccordionValue)
        onValueChange?.(next)
        return
      }
      setInternal((prev) => {
        const next = compute(prev)
        if (next !== prev) onValueChange?.(next)
        return next
      })
    },
    [multiple, collapsible, isControlled, onValueChange],
  )

  const rootId = React.useId()

  const ctx = React.useMemo(
    () => ({ isOpen, toggle, rootId, collapsible, multiple }),
    [isOpen, toggle, rootId, collapsible, multiple],
  )

  return (
    <AccordionContext.Provider value={ctx}>
      <div
        {...rest}
        data-iris-accordion=""
        data-iris-accordion-multiple={multiple ? 'true' : undefined}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  )
}
