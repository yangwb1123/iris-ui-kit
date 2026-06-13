import { describe, expect, it } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import {
  runContract,
  tabsScenario,
  switchScenario,
  checkboxScenario,
  accordionScenario,
  segmentedScenario,
  toggleGroupScenario,
  toggleGroupMultiScenario,
  sliderScenario,
  radioScenario,
  numberInputScenario,
  ratingScenario,
  paginationScenario,
  stepperScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import ContractsHarness from './ContractsHarness.svelte'
import RatingContractHarness from './RatingContractHarness.svelte'
import ToggleGroupMultiContractHarness from './ToggleGroupMultiContractHarness.svelte'

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

  it('satisfies the shared Segmented contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(segmentedScenario, driverFor(container), expect)
  })

  it('satisfies the shared ToggleGroup contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(toggleGroupScenario, driverFor(container), expect)
  })

  it('satisfies the shared multiple-mode ToggleGroup contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so its
    // three `[data-iris-toggle-group-item]` buttons do not collide with the
    // single-mode group's three in the shared harness — which would make that
    // selector count 6 and break both groups' `count === 3` assertions. See
    // ToggleGroupMultiContractHarness.svelte for the full note.
    const { container } = render(ToggleGroupMultiContractHarness)
    await runContract(toggleGroupMultiScenario, driverFor(container), expect)
  })

  it('satisfies the shared Slider contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(sliderScenario, driverFor(container), expect)
  })

  it('satisfies the shared Radio contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(radioScenario, driverFor(container), expect)
  })

  it('satisfies the shared NumberInput contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(numberInputScenario, driverFor(container), expect)
  })

  it('satisfies the shared Pagination contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(paginationScenario, driverFor(container), expect)
  })

  it('satisfies the shared Stepper contract', async () => {
    const { container } = render(ContractsHarness)
    await runContract(stepperScenario, driverFor(container), expect)
  })

  it('satisfies the shared Rating contract', async () => {
    // Rendered in a dedicated harness (not the shared ContractsHarness) so the
    // rating's role="slider" container does not collide with the IrisSlider thumb,
    // which would break the shared Slider scenario's globally-unique `[role="slider"]`
    // (count === 1) assertion. See RatingContractHarness.svelte for the full note.
    const { container } = render(RatingContractHarness)
    await runContract(ratingScenario, driverFor(container), expect)
  })
})
