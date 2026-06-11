import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import {
  runContract,
  tabsScenario,
  switchScenario,
  checkboxScenario,
  accordionScenario,
  type ContractDriver,
} from '@iris-ui/core/contracts'
import { IrisTabs } from './primitives/tabs/Tabs'
import { IrisTabsList } from './primitives/tabs/TabsList'
import { IrisTabsTrigger } from './primitives/tabs/TabsTrigger'
import { IrisTabsContent } from './primitives/tabs/TabsContent'
import { IrisSwitch } from './primitives/switch/Switch'
import { IrisCheckbox } from './primitives/checkbox/Checkbox'
import { IrisAccordion } from './primitives/accordion/Accordion'
import { IrisAccordionItem } from './primitives/accordion/AccordionItem'

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

/**
 * IrisCheckbox is v-model based (it emits on the native input's `change`), so —
 * exactly like the Switch harness — mount it inside a wrapper holding a reactive
 * boolean bound with v-model. A native click on the hidden `<input type=checkbox>`
 * toggles its `.checked` and fires `change`, flipping the boolean and re-rendering
 * the checkbox with the new `aria-checked`. Starts unchecked (false), matching the
 * uncontrolled React/Solid/Svelte reference.
 */
const CheckboxHarness = defineComponent({
  name: 'CheckboxHarness',
  setup() {
    const checked = ref(false)
    return () =>
      h(IrisCheckbox, {
        modelValue: checked.value,
        'onUpdate:modelValue': (v: boolean) => {
          checked.value = v
        },
      })
  },
})

/**
 * EXACT same setup as the React reference: IrisAccordion with two
 * IrisAccordionItem (value "a"/"b", a title each) and NO defaultValue → both
 * items collapsed by default.
 */
const AccordionHarness = defineComponent({
  name: 'AccordionHarness',
  setup() {
    return () =>
      h(IrisAccordion, null, () => [
        h(IrisAccordionItem, { value: 'a', title: 'A' }, () => 'Panel A'),
        h(IrisAccordionItem, { value: 'b', title: 'B' }, () => 'Panel B'),
      ])
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

  it('satisfies the shared Checkbox contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(CheckboxHarness, { attachTo: host })
    await nextTick()
    await runContract(checkboxScenario, driverFor(wrapper.element as HTMLElement), expect)
  })

  it('satisfies the shared Accordion contract', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(AccordionHarness, { attachTo: host })
    await nextTick()
    await runContract(accordionScenario, driverFor(wrapper.element as HTMLElement), expect)
  })
})
