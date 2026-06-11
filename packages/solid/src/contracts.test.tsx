import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import {
  runContract,
  tabsScenario,
  switchScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import {
  IrisTabs,
  IrisTabsList,
  IrisTabsTrigger,
  IrisTabsContent,
} from './primitives/tabs/IrisTabs'
import { IrisSwitch } from './primitives/switch/Switch'

afterEach(cleanup)

/**
 * A ContractDriver over a Solid-testing-library container. Solid reactivity is
 * synchronous in tests, so `flush()` is a no-op; `fireEvent` settles updates.
 */
function driverFor(container: HTMLElement): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
    queryAll: (selector) => Array.from(container.querySelectorAll(selector)),
    click: (selector, index) => {
      const el = at(selector, index)
      if (el) fireEvent.click(el)
    },
    keydown: (selector, index, key) => {
      const el = at(selector, index)
      if (el) fireEvent.keyDown(el, { key })
    },
    flush: () => {},
  }
}

describe('@iris-ui/solid — cross-framework behavior contracts', () => {
  it('satisfies the shared Tabs contract', async () => {
    const { container } = render(() => (
      <IrisTabs defaultValue="a">
        <IrisTabsList>
          <IrisTabsTrigger value="a">Tab A</IrisTabsTrigger>
          <IrisTabsTrigger value="b">Tab B</IrisTabsTrigger>
          <IrisTabsTrigger value="c">Tab C</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="a">Panel A</IrisTabsContent>
        <IrisTabsContent value="b">Panel B</IrisTabsContent>
        <IrisTabsContent value="c">Panel C</IrisTabsContent>
      </IrisTabs>
    ))
    await runContract(tabsScenario, driverFor(container), expect)
  })

  it('satisfies the shared Switch contract', async () => {
    const { container } = render(() => <IrisSwitch />)
    await runContract(switchScenario, driverFor(container), expect)
  })
})
