import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { IrisI18nProvider } from './I18nProvider'
import { useI18n } from './useI18n'

const Probe = defineComponent({
  setup() {
    const { locale, t, formatNumber, setLocale } = useI18n()
    return () =>
      h('div', null, [
        h('span', { class: 'locale' }, locale.value),
        h('span', { class: 'next' }, t('pagination.next')),
        h('span', { class: 'page' }, t('pagination.page', { page: 2 })),
        h('span', { class: 'num' }, formatNumber(1234.5)),
        h('button', { class: 'de', onClick: () => setLocale('de-DE') }, 'de'),
      ])
  },
})

function withProvider(props: { locale?: string; messages?: Record<string, string> }) {
  return defineComponent({
    setup() {
      return () => h(IrisI18nProvider, props, { default: () => h(Probe) })
    },
  })
}

describe('@iris-ui/vue i18n', () => {
  it('falls back to English defaults without a provider', () => {
    const wrapper = mount(Probe)
    expect(wrapper.find('.locale').text()).toBe('en-US')
    expect(wrapper.find('.next').text()).toBe('Next page')
    expect(wrapper.find('.page').text()).toBe('Page 2')
  })

  it('uses provider locale + message overrides', () => {
    const wrapper = mount(
      withProvider({ locale: 'de-DE', messages: { 'pagination.next': 'Weiter' } }),
    )
    expect(wrapper.find('.locale').text()).toBe('de-DE')
    expect(wrapper.find('.next').text()).toBe('Weiter')
    expect(wrapper.find('.num').text()).toBe('1.234,5')
  })

  it('re-renders consumers when the locale changes', async () => {
    const wrapper = mount(withProvider({ locale: 'en-US' }))
    expect(wrapper.find('.num').text()).toBe('1,234.5')
    await wrapper.find('.de').trigger('click')
    await flushPromises()
    expect(wrapper.find('.locale').text()).toBe('de-DE')
    expect(wrapper.find('.num').text()).toBe('1.234,5')
  })

  it('syncs a changed locale prop into the live instance', async () => {
    const wrapper = mount(IrisI18nProvider, {
      props: { locale: 'en-US' },
      slots: { default: () => h(Probe) },
    })
    expect(wrapper.find('.num').text()).toBe('1,234.5')
    await wrapper.setProps({ locale: 'de-DE' })
    await flushPromises()
    expect(wrapper.find('.locale').text()).toBe('de-DE')
    expect(wrapper.find('.num').text()).toBe('1.234,5')
  })
})
