import type {
  ContractAssertion,
  ContractDriver,
  ContractElement,
  ContractExpect,
  ContractScenario,
} from './types'

/** The ambient document (jsdom/browser), typed minimally — core stays DOM-lib-free. */
const doc = () =>
  (globalThis as { document?: { querySelectorAll(s: string): unknown[]; activeElement: unknown } })
    .document

/** Read the assertion target value from the resolved element (or null when absent). */
function readValue(el: ContractElement | undefined, read: string): string | null {
  if (read === 'focused') return el != null && el === doc()?.activeElement ? 'true' : 'false'
  if (el == null) return null
  if (read === 'text') return (el.textContent ?? '').trim()
  if (read === 'value') return (el as unknown as { value: string }).value ?? ''
  return el.getAttribute(read)
}

function check(
  driver: ContractDriver,
  scenario: string,
  step: string,
  a: ContractAssertion,
  expect: ContractExpect,
): void {
  // `global` reads escape the container (document-scoped), so post-unmount /
  // portal-leak assertions can run with no container to scope to.
  const els = a.global
    ? (Array.from(doc()?.querySelectorAll(a.selector) ?? []) as unknown as ContractElement[])
    : driver.queryAll(a.selector)
  const where = `${scenario} › ${step} › ${a.selector}${a.global ? ' (global)' : ''}`
  if (a.read === 'count') {
    expect(els.length, `${where} (count)`).toBe(a.equals)
    return
  }
  const actual = readValue(els[a.index ?? 0], a.read)
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
    if (step.action === 'unmount') {
      await driver.unmount()
    } else if (step.action !== 'none') {
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
      else if (step.action === 'type') await driver.type(selector, index, step.typeText ?? '')
      else if (step.action === 'dblclick') await driver.dblclick(selector, index)
    }
    await driver.flush()
    for (const a of step.expect) check(driver, scenario.name, step.label, a, expect)
  }
}
