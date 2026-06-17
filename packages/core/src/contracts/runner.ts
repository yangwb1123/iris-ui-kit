import type { ContractAssertion, ContractDriver, ContractExpect, ContractScenario } from './types'

function check(
  driver: ContractDriver,
  scenario: string,
  step: string,
  a: ContractAssertion,
  expect: ContractExpect,
): void {
  const els = driver.queryAll(a.selector)
  const where = `${scenario} › ${step} › ${a.selector}`
  if (a.read === 'count') {
    expect(els.length, `${where} (count)`).toBe(a.equals)
    return
  }
  const el = els[a.index ?? 0]
  const actual =
    el == null ? null : a.read === 'text' ? (el.textContent ?? '').trim() : el.getAttribute(a.read)
  expect(actual, `${where} [${a.index ?? 0}] ${a.read}`).toBe(
    a.equals === null ? null : String(a.equals),
  )
}

/**
 * Run a {@link ContractScenario} against a mounted component via a
 * {@link ContractDriver}, asserting with the injected `expect`. For each step:
 * perform its action (on the resolved target), flush reactivity, then check
 * every assertion. A failed assertion throws (vitest `expect`), failing the test.
 */
export async function runContract(
  scenario: ContractScenario,
  driver: ContractDriver,
  expect: ContractExpect,
): Promise<void> {
  for (const step of scenario.steps) {
    if (step.action !== 'none') {
      const selector = step.target ?? ''
      const index = step.index ?? 0
      expect(
        driver.queryAll(selector).length > index,
        `${scenario.name} › ${step.label}: target "${selector}" [${index}] not found`,
      ).toBe(true)
      if (step.action === 'click') await driver.click(selector, index)
      else if (step.action === 'keydown') await driver.keydown(selector, index, step.key ?? '')
      else if (step.action === 'pointer')
        await driver.pointer(selector, index, step.pointerEvent ?? 'enter')
    }
    await driver.flush()
    for (const a of step.expect) check(driver, scenario.name, step.label, a, expect)
  }
}
