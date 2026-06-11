import { describe, it, expect } from 'vitest'
import { runContract } from './runner'
import { switchScenario } from './scenarios/switch'
import type { ContractDriver } from './types'

// An in-memory stand-in for a Switch — no framework, no DOM — proving the runner
// drives a scenario end-to-end: one element whose aria-checked toggles on click.
function fakeSwitchDriver(): ContractDriver {
  let checked = false
  const el = {
    getAttribute: (n: string) => (n === 'aria-checked' ? String(checked) : null),
    textContent: '',
  }
  return {
    queryAll: (sel) => (sel === '[role="switch"]' ? [el] : []),
    click: () => {
      checked = !checked
    },
    keydown: () => {},
    flush: () => {},
  }
}

describe('runContract', () => {
  it('passes when the driver matches the contract', async () => {
    await runContract(switchScenario, fakeSwitchDriver(), expect)
  })

  it('throws when the driver diverges (click does nothing)', async () => {
    const broken: ContractDriver = { ...fakeSwitchDriver(), click: () => {} }
    await expect(runContract(switchScenario, broken, expect)).rejects.toThrow()
  })
})
