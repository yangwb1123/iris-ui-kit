import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import {
  runContract,
  tabsScenario,
  switchScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import { IrisTabs } from './primitives/tabs/Tabs'
import { IrisTabsList } from './primitives/tabs/TabsList'
import { IrisTabsTrigger } from './primitives/tabs/TabsTrigger'
import { IrisTabsContent } from './primitives/tabs/TabsContent'
import { IrisSwitch } from './primitives/switch/Switch'

enableAutoUnmount(afterEach)

/**
 * A ContractDriver over a mounted root element. Clicks/keys are native DOM
 * events dispatched on the resolved element (bubbling+cancelable, so Vue's
 * listeners fire); `flush()` awaits a `nextTick()` so the post-step DOM is final
 * before assertions read it. A click on a `<input type=checkbox>` toggles its
 * `.checked` and fires the `change` event the Switch listens to in jsdom.
 */
function driverFor(container: HTMLElement): ContractDriver {
  const at = (selector: string, index: number) =>
    container.querySelectorAll<HTMLElement>(selector)[index]
  return {
    queryAll: (selector) => Array.from(container.querySelectorAll(selector)),
    click: (selector, index) => {
      const el = at(selector, index)
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    },
    keydown: (selector, index, key) => {
      const el = at(selector, index)
      if (el)
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    },
    flush: () => nextTick(),
  }
}

/**
 * IrisSwitch is v-model based, so mount it inside a tiny wrapper holding a
 * reactive boolean bound with v-model — clicking the control flips the boolean,
 * re-rendering the switch with the new `aria-checked`. Starts OFF (false),
 * matching the uncontrolled React/Solid/Svelte reference.
 */
const SwitchHarness = defineComponent({
  name: 'SwitchHarness',
  setup() {
    const on = ref(false)
    return () =>
      h(IrisSwitch, {
        modelValue: on.value,
        'onUpdate:modelValue': (v: boolean) => {
          on.value = v
        },
      })
  },
})

/** EXACT same setup as the React reference: defaultValue "a", Tab A/B/C, Panel A/B/C. */
const TabsHarness = defineComponent({
  name: 'TabsHarness',
  setup() {
    return () =>
      h(IrisTabs, { defaultValue: 'a' }, () => [
        h(IrisTabsList, null, () => [
          h(IrisTabsTrigger, { value: 'a' }, () => 'Tab A'),
          h(IrisTabsTrigger, { value: 'b' }, () => 'Tab B'),
          h(IrisTabsTrigger, { value: 'c' }, () => 'Tab C'),
        ]),
        h(IrisTabsContent, { value: 'a' }, () => 'Panel A'),
        h(IrisTabsContent, { value: 'b' }, () => 'Panel B'),
        h(IrisTabsContent, { value: 'c' }, () => 'Panel C'),
      ])
  },
})

describe('@iris-ui/vue — cross-framework behavior contracts', () => {
  it('satisfies the shared Tabs contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(TabsHarness, { attachTo: host })
    await nextTick()
    await runContract(tabsScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Switch contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(SwitchHarness, { attachTo: host })
    await nextTick()
    await runContract(switchScenario, driverFor(wrapper.element as HTMLElement), expect)
  })
})
