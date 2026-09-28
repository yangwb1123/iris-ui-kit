// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  BOOLEAN_ATTRIBUTES,
  attributeNameFromProp,
  cssTextToStyleObject,
  escapeAttributeValue,
  eventNameFromProp,
  isEventProp,
  mergeClassIntoElement,
  mergeClassValues,
  mergeSlotProps,
  mergeStyleIntoCssText,
  mergeStyleIntoElement,
  mergeStyleValues,
  parseCssDeclarations,
  patchOpeningTag,
  styleText,
} from './slot'

describe('isEventProp / eventNameFromProp', () => {
  it('accepts both the capitalised and lowercase handler conventions', () => {
    expect(isEventProp('onClick')).toBe(true)
    expect(isEventProp('onValueChange')).toBe(true)
    // Svelte 5 spells DOM events lowercase.
    expect(isEventProp('onclick')).toBe(true)
    expect(isEventProp('onkeydown')).toBe(true)
  })

  it('rejects non-handler keys', () => {
    expect(isEventProp('once')).toBe(false)
    expect(isEventProp('only')).toBe(false)
    expect(isEventProp('one')).toBe(false)
    expect(isEventProp('value')).toBe(false)
  })

  it('derives the DOM event name and drops a capture suffix', () => {
    expect(eventNameFromProp('onClick')).toBe('click')
    expect(eventNameFromProp('onValueChange')).toBe('valuechange')
    expect(eventNameFromProp('onclick')).toBe('click')
    expect(eventNameFromProp('onClickCapture')).toBe('click')
  })
})

describe('mergeClassValues', () => {
  it('puts parent tokens first so the child stays last in the cascade', () => {
    expect(mergeClassValues('parent', 'child')).toBe('parent child')
  })

  it('drops duplicates so re-merging the same pair is idempotent', () => {
    expect(mergeClassValues('a b', 'b c')).toBe('a b c')
    expect(mergeClassValues(mergeClassValues('a b', 'b c'), 'b c')).toBe('a b c')
  })

  it('normalises surrounding and repeated whitespace', () => {
    expect(mergeClassValues('  a   b ', ' c ')).toBe('a b c')
  })

  it('returns undefined when nothing survives', () => {
    expect(mergeClassValues(undefined, undefined)).toBeUndefined()
    expect(mergeClassValues('   ', '')).toBeUndefined()
  })

  it('accepts an array form', () => {
    expect(mergeClassValues(['a', 'b'], ['b', 'c'])).toBe('a b c')
  })

  it('tolerates non-string input', () => {
    expect(mergeClassValues(null, 'child')).toBe('child')
    expect(mergeClassValues(42, undefined)).toBeUndefined()
  })
})

describe('styleText / mergeStyleValues', () => {
  it('renders an object map as CSS text', () => {
    expect(styleText({ color: 'red', padding: '4px' })).toBe('color: red; padding: 4px')
  })

  it('drops null and undefined declarations', () => {
    expect(styleText({ color: 'red', margin: null, top: undefined })).toBe('color: red')
  })

  it('merges parent first and child last', () => {
    expect(mergeStyleValues({ color: 'red' }, { color: 'blue' })).toBe('color: blue')
    expect(mergeStyleValues('color: red', 'padding: 4px')).toBe('color: red; padding: 4px')
  })

  it('normalises a trailing semicolon so merges never double up', () => {
    expect(mergeStyleValues('color: red;', 'padding: 4px;')).toBe('color: red; padding: 4px')
    expect(mergeStyleValues(mergeStyleValues('a: 1;', 'b: 2;'), 'c: 3;')).toBe('a: 1; b: 2; c: 3')
  })

  it('returns undefined when there is nothing to apply', () => {
    expect(mergeStyleValues(undefined, undefined)).toBeUndefined()
  })

  it('mixing a string and an object still merges in order', () => {
    expect(mergeStyleValues('color: red', { padding: '4px' })).toBe('color: red; padding: 4px')
  })
})

describe('mergeSlotProps', () => {
  it('composes handlers parent-first and lets the parent veto via preventDefault', () => {
    const order: string[] = []
    const parent = {
      onClick: () => order.push('parent'),
    }
    const child = {
      onClick: () => order.push('child'),
    }
    const merged = mergeSlotProps(parent, child)
    ;(merged.onClick as (e: { defaultPrevented: boolean }) => void)({ defaultPrevented: false })
    expect(order).toEqual(['parent', 'child'])
  })

  it('skips the child handler when the parent prevents the default', () => {
    const child = vi.fn()
    const merged = mergeSlotProps(
      { onClick: (e: { defaultPrevented: boolean }) => (e.defaultPrevented = true) },
      { onClick: child },
    )
    merged.onClick?.({ defaultPrevented: false })
    expect(child).not.toHaveBeenCalled()
  })

  it('composes lowercase Svelte-style handlers too', () => {
    const child = vi.fn()
    const merged = mergeSlotProps({ onclick: () => undefined }, { onclick: child })
    merged.onclick?.({ defaultPrevented: false })
    expect(child).toHaveBeenCalledTimes(1)
  })

  it('keeps a parent-only handler', () => {
    const parent = { onClick: () => undefined }
    expect(mergeSlotProps(parent, {})).toHaveProperty('onClick')
  })

  it('lets the child win on ordinary props, including an explicit undefined', () => {
    const merged = mergeSlotProps({ id: 'parent', title: 'parent' }, { title: undefined })
    expect(merged.title).toBeUndefined()
    expect('title' in merged).toBe(true)
    expect(merged.id).toBe('parent')
  })

  it('merges class parent-first and de-duplicates', () => {
    const merged = mergeSlotProps({ class: 'parent shared' }, { class: 'shared child' })
    expect(merged.class).toBe('parent shared child')
  })

  it('honours the className key for React-style adapters', () => {
    const merged = mergeSlotProps(
      { className: 'parent' },
      { className: 'child' },
      {
        classKey: 'className',
      },
    )
    expect(merged.className).toBe('parent child')
  })

  it('merges style parent-first with child last', () => {
    const merged = mergeSlotProps(
      { style: { color: 'red', margin: '1px' } },
      { style: { color: 'blue' } },
    )
    expect(merged.style).toBe('color: blue; margin: 1px')
  })

  it('emits a style object when the adapter needs one', () => {
    const merged = mergeSlotProps(
      { style: 'color: red' },
      { style: 'padding: 4px' },
      {
        styleAsObject: true,
      },
    )
    expect(merged.style).toEqual({ color: 'red', padding: '4px' })
  })

  it('applies a parent class even when the child has none (SSR needs a real attribute)', () => {
    const merged = mergeSlotProps({ class: 'parent' }, {})
    expect(merged.class).toBe('parent')
  })

  it('applies a parent style even when the child has none', () => {
    const merged = mergeSlotProps({ style: 'color: red' }, {})
    expect(merged.style).toBe('color: red')
  })

  it('leaves ref alone by default so the adapter can compose it', () => {
    const parentRef = { current: null }
    const childRef = { current: null }
    const merged = mergeSlotProps({ ref: parentRef }, { ref: childRef }, { preserveRef: true })
    // Uncomposed — and absent entirely, so the adapter owns ref fan-out rather
    // than silently receiving one side.
    expect(merged.ref).toBeUndefined()
  })

  it('passes ref through untouched when the adapter does not claim it', () => {
    const parentRef = { current: null }
    expect(mergeSlotProps({ ref: parentRef }, {}).ref).toBe(parentRef)
  })

  it('is order-stable for repeated merges', () => {
    const once = mergeSlotProps({ class: 'p', onClick: () => undefined }, { class: 'c' })
    const twice = mergeSlotProps(once, { class: 'p c' })
    expect(twice.class).toBe('p c')
  })
})

describe('attributeNameFromProp', () => {
  it('maps the two class spellings and the label association', () => {
    expect(attributeNameFromProp('className')).toBe('class')
    expect(attributeNameFromProp('htmlFor')).toBe('for')
  })

  it('kebab-cases camelCase props', () => {
    expect(attributeNameFromProp('ariaLive')).toBe('aria-live')
    expect(attributeNameFromProp('tabIndex')).toBe('tab-index')
  })

  it('honours an attr: escape hatch verbatim', () => {
    expect(attributeNameFromProp('attr:myCustomAttr')).toBe('myCustomAttr')
  })
})

describe('escapeAttributeValue / BOOLEAN_ATTRIBUTES', () => {
  it('escapes the characters that would break out of an attribute', () => {
    expect(escapeAttributeValue('a"b&c<d')).toBe('a&quot;b&amp;c&lt;d')
  })

  it('exposes the boolean set used for bare-name serialisation', () => {
    expect(BOOLEAN_ATTRIBUTES.has('disabled')).toBe(true)
    expect(BOOLEAN_ATTRIBUTES.has('id')).toBe(false)
  })
})

describe('patchOpeningTag', () => {
  it('adds parent attributes that the child does not already set', () => {
    const out = patchOpeningTag('<a href="/x">', { id: 'trigger', 'aria-label': 'Open' })
    expect(out).toBe('<a href="/x" id="trigger" aria-label="Open">')
  })

  it('never overwrites an attribute the child already set', () => {
    const out = patchOpeningTag('<a id="child">', { id: 'parent' })
    expect(out).toBe('<a id="child">')
  })

  it('appends the parent class after the child class', () => {
    const out = patchOpeningTag('<a class="child">', { class: 'parent' })
    expect(out).toBe('<a class="parent child">')
  })

  it('adds a class attribute when the child has none', () => {
    expect(patchOpeningTag('<a>', { class: 'parent' })).toBe('<a class="parent">')
  })

  it('appends the parent style after the child style', () => {
    expect(patchOpeningTag('<a style="color: blue">', { style: { color: 'red' } })).toBe(
      '<a style="color: red; color: blue">',
    )
  })

  it('serialises boolean attributes as a bare name only when truthy', () => {
    expect(patchOpeningTag('<a>', { disabled: true })).toBe('<a disabled>')
    expect(patchOpeningTag('<a>', { disabled: false })).toBe('<a>')
  })

  it('skips handlers, children, ref and nullish values', () => {
    const out = patchOpeningTag('<a>', {
      onClick: () => undefined,
      children: 'x',
      ref: null,
      title: null,
    })
    expect(out).toBe('<a>')
  })

  it('escapes attribute values it writes', () => {
    expect(patchOpeningTag('<a>', { title: 'a"b' })).toBe('<a title="a&quot;b">')
  })

  it('returns the input untouched when there is no closing angle bracket', () => {
    expect(patchOpeningTag('<a', { id: 'x' })).toBe('<a')
  })

  it('returns the input untouched when there is nothing to add', () => {
    const opening = '<a id="child">'
    expect(patchOpeningTag(opening, { id: 'parent' })).toBe(opening)
  })
})

describe('live-element helpers', () => {
  it('mergeClassIntoElement keeps the child class and skips duplicates', () => {
    const el = document.createElement('a')
    el.setAttribute('class', 'child shared')
    mergeClassIntoElement(el, 'parent shared')
    expect(el.getAttribute('class')).toBe('parent shared child')
  })

  it('mergeStyleIntoElement does not overwrite a property the child already set', () => {
    const el = document.createElement('div')
    el.style.setProperty('color', 'blue')
    mergeStyleIntoElement(el, { color: 'red', padding: '4px' })
    expect(el.style.getPropertyValue('color')).toBe('blue')
    expect(el.style.getPropertyValue('padding')).toBe('4px')
  })

  it('mergeStyleIntoCssText replaces matching names and keeps order', () => {
    expect(mergeStyleIntoCssText('color: red; padding: 2px', 'color: blue; margin: 0')).toBe(
      'color: red; margin: 0; padding: 2px',
    )
  })

  it('is a no-op with nothing to apply', () => {
    expect(mergeStyleIntoCssText(undefined, 'color: blue')).toBe('color: blue')
  })
})

describe('css text helpers', () => {
  it('round-trips through an object map', () => {
    expect(cssTextToStyleObject('color: red; padding: 4px')).toEqual({
      color: 'red',
      padding: '4px',
    })
  })

  it('parses declarations in order and skips malformed ones', () => {
    expect(parseCssDeclarations('a: 1; junk; b: 2')).toEqual([
      ['a', '1'],
      ['b', '2'],
    ])
  })
})
