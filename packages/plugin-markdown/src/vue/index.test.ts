import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisMarkdown } from './index'

describe('IrisMarkdown (vue)', () => {
  it('renders the data-iris-markdown container', () => {
    const wrapper = mount(IrisMarkdown, { props: { content: 'Hello' } })
    expect(wrapper.find('[data-iris-markdown]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders a heading from # syntax', () => {
    const wrapper = mount(IrisMarkdown, { props: { content: '# Hello World' } })
    expect(wrapper.find('h1').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Hello World')
    wrapper.unmount()
  })

  it('renders bold inline element', () => {
    const wrapper = mount(IrisMarkdown, { props: { content: '**bold**' } })
    expect(wrapper.find('strong').text()).toBe('bold')
    wrapper.unmount()
  })

  it('renders an unordered list', () => {
    const wrapper = mount(IrisMarkdown, { props: { content: '- Alpha\n- Beta' } })
    expect(wrapper.find('ul').exists()).toBe(true)
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    wrapper.unmount()
  })

  it('renders a link', () => {
    const wrapper = mount(IrisMarkdown, { props: { content: '[Iris](https://iris-ui.dev)' } })
    const a = wrapper.find('a')
    expect(a.attributes('href')).toBe('https://iris-ui.dev')
    wrapper.unmount()
  })

  it('does not render script tags', () => {
    const wrapper = mount(IrisMarkdown, {
      props: { content: '<script>alert(1)</script>Safe' },
    })
    expect(wrapper.find('script').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders allowlisted raw tags without interpreting encoded markup', () => {
    const wrapper = mount(IrisMarkdown, {
      props: { content: '<mark>safe</mark> &lt;script&gt;inert&lt;/script&gt;' },
    })
    expect(wrapper.find('mark').text()).toBe('safe')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('<script>inert</script>')
    wrapper.unmount()
  })

  it('accepts a class prop', () => {
    const wrapper = mount(IrisMarkdown, { props: { content: 'Hi', class: 'prose' } })
    expect(wrapper.find('.prose').exists()).toBe(true)
    wrapper.unmount()
  })
})
