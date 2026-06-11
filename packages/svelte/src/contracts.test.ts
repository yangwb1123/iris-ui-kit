import { describe, expect, it } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import {
  runContract,
  tabsScenario,
  switchScenario,
  checkboxScenario,
  accordionScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import ContractsHarness from './ContractsHarness.svelte'

/** A ContractDriver over a @testing-library/svelte result container. */
function driverFor(container: HTMLElement): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
    queryAll: (selector) => Array.from(container.querySelectorAll(selector)),
    click: async (selector, index) => {
      const el = at(selector, index)
      if (el) await fireEvent.click(el)
    },
    keydown: async (selector, index, key) => {
      const el = at(selector, index)
      if (el) await fireEvent.keyDown(el, { key })
    },
    flush: () => {
      flushSync()
    },
  }
}

describe('@iris-ui/svelte — cross-framework behavior contracts', () => {
  it('satisfies the shared Tabs contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(tabsScenario, driverFor(container), expect)
  })

  it('satisfies the shared Switch contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(switchScenario, driverFor(container), expect)
  })

  it('satisfies the shared Checkbox contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(checkboxScenario, driverFor(container), expect)
  })

  it('satisfies the shared Accordion contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(accordionScenario, driverFor(container), expect)
  })
})
