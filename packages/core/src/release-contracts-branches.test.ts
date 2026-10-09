import { afterEach, describe, expect, it, vi } from 'vitest'
import { runContract } from './contracts/runner'
import type {
  ContractDriver,
  ContractElement,
  ContractScenario,
  ContractStep,
} from './contracts/types'

afterEach(() => vi.unstubAllGlobals())

function element(
  textContent: string | null,
  value?: string,
  attributes: Record<string, string> = {},
) {
  return { textContent, value, getAttribute: (name: string) => attributes[name] ?? null }
}

function driverFor(matches: Record<string, ContractElement[]>): ContractDriver {
  return {
    queryAll: vi.fn((selector: string) => matches[selector] ?? []),
    click: vi.fn(),
    keydown: vi.fn(),
    pointer: vi.fn(),
    type: vi.fn(),
    dblclick: vi.fn(),
    unmount: vi.fn(),
    flush: vi.fn(),
  }
}

function scenario(steps: ContractStep[]): ContractScenario {
  return { name: 'Edge contract', description: 'Runner behavior at the driver boundary', steps }
}

describe('release contract runner branches', () => {
  it('reads trimmed text, values, attributes and absent targets at the requested index', async () => {
    const driver = driverFor({
      '.item': [element('  Ada\n ', 'typed', { 'aria-level': '2' }), element(null)],
    })
    await runContract(
      scenario([
        {
          label: 'read',
          action: 'none',
          expect: [
            { selector: '.item', read: 'count', equals: 2 },
            { selector: '.item', read: 'text', equals: 'Ada' },
            { selector: '.item', read: 'value', equals: 'typed' },
            { selector: '.item', read: 'aria-level', equals: 2 },
            { selector: '.item', read: 'aria-missing', equals: null },
            { selector: '.item', index: 1, read: 'text', equals: '' },
            { selector: '.item', index: 1, read: 'value', equals: '' },
            { selector: '.item', index: 2, read: 'text', equals: null },
          ],
        },
      ]),
      driver,
      expect,
    )
    expect(driver.click).not.toHaveBeenCalled()
    expect(driver.flush).toHaveBeenCalledOnce()
  })

  it('resolves global portal assertions and focus independently of the mounted root', async () => {
    const focused = element('focused')
    const other = element('other')
    const querySelectorAll = vi.fn(() => [focused, other])
    vi.stubGlobal('document', { activeElement: focused, querySelectorAll })
    const driver = driverFor({})
    await runContract(
      scenario([
        {
          label: 'portal',
          action: 'none',
          expect: [
            { selector: '.portal', global: true, read: 'count', equals: 2 },
            { selector: '.portal', global: true, read: 'focused', equals: 'true' },
            { selector: '.portal', global: true, index: 1, read: 'focused', equals: 'false' },
            { selector: '.portal', global: true, index: 2, read: 'focused', equals: 'false' },
          ],
        },
      ]),
      driver,
      expect,
    )
    expect(querySelectorAll).toHaveBeenCalledWith('.portal')
    expect(driver.queryAll).not.toHaveBeenCalled()
  })

  it('treats an unavailable document as an empty global scope with no focused element', async () => {
    vi.stubGlobal('document', undefined)
    await runContract(
      scenario([
        {
          label: 'SSR',
          action: 'none',
          expect: [
            { selector: '.portal', global: true, read: 'count', equals: 0 },
            { selector: '.portal', global: true, read: 'text', equals: null },
            { selector: '.item', read: 'focused', equals: 'false' },
          ],
        },
      ]),
      driverFor({ '.item': [element('mounted')] }),
      expect,
    )
  })

  const interactions: Array<{ step: ContractStep; args: unknown[] }> = [
    { step: { label: 'click', action: 'click', expect: [] }, args: ['', 0] },
    { step: { label: 'key default', action: 'keydown', expect: [] }, args: ['', 0, ''] },
    { step: { label: 'pointer default', action: 'pointer', expect: [] }, args: ['', 0, 'enter'] },
    { step: { label: 'type default', action: 'type', expect: [] }, args: ['', 0, ''] },
    { step: { label: 'double click', action: 'dblclick', expect: [] }, args: ['', 0] },
    {
      step: {
        label: 'key',
        action: 'keydown',
        target: '.item',
        index: 1,
        key: 'Escape',
        expect: [],
      },
      args: ['.item', 1, 'Escape'],
    },
    {
      step: {
        label: 'pointer',
        action: 'pointer',
        target: '.item',
        index: 1,
        pointerEvent: 'leave',
        expect: [],
      },
      args: ['.item', 1, 'leave'],
    },
    {
      step: {
        label: 'type',
        action: 'type',
        target: '.item',
        index: 1,
        typeText: 'Ada',
        expect: [],
      },
      args: ['.item', 1, 'Ada'],
    },
  ]

  it.each(interactions)(
    'awaits $step.label and flush before reading assertions',
    async ({ step, args }) => {
      const item = element('initial')
      const driver = driverFor({ '': [item], '.item': [item, item] })
      const order: string[] = []
      const action = vi.fn(async () => {
        await Promise.resolve()
        item.textContent = 'action complete'
        order.push('action')
      })
      Object.assign(driver, { [step.action]: action })
      driver.flush = async () => {
        expect(item.textContent).toBe('action complete')
        await Promise.resolve()
        item.textContent = 'settled'
        order.push('flush')
      }
      await runContract(
        scenario([{ ...step, expect: [{ selector: '.item', read: 'text', equals: 'settled' }] }]),
        driver,
        expect,
      )
      expect(action).toHaveBeenCalledWith(...args)
      expect(order).toEqual(['action', 'flush'])
    },
  )

  it('awaits unmount and flush before checking document-scoped cleanup', async () => {
    let portals: ContractElement[] = [element('dialog')]
    const order: string[] = []
    vi.stubGlobal('document', { querySelectorAll: () => portals })
    const driver = driverFor({})
    driver.unmount = async () => {
      await Promise.resolve()
      order.push('unmount')
    }
    driver.flush = async () => {
      await Promise.resolve()
      portals = []
      order.push('flush')
    }
    await runContract(
      scenario([
        {
          label: 'destroy',
          action: 'unmount',
          expect: [{ selector: '[role="dialog"]', global: true, read: 'count', equals: 0 }],
        },
      ]),
      driver,
      expect,
    )
    expect(order).toEqual(['unmount', 'flush'])
    expect(driver.queryAll).not.toHaveBeenCalled()
  })

  it('fails a missing action target with selector/index context before dispatch or flush', async () => {
    const driver = driverFor({})
    await expect(
      runContract(
        scenario([
          { label: 'activate', action: 'click', target: '#missing', index: 2, expect: [] },
        ]),
        driver,
        expect,
      ),
    ).rejects.toThrow('Edge contract › activate: target "#missing" [2] not found')
    expect(driver.click).not.toHaveBeenCalled()
    expect(driver.flush).not.toHaveBeenCalled()
  })

  it.each(['click', 'unmount', 'flush'] as const)(
    'propagates %s failures without reading assertions',
    async (method) => {
      const getAttribute = vi.fn(() => 'true')
      const driver = driverFor({ '.item': [{ textContent: '', getAttribute }] })
      const failure = new Error(`${method} failed`)
      driver[method] = async () => {
        throw failure
      }
      await expect(
        runContract(
          scenario([
            {
              label: 'failure',
              action: method === 'flush' ? 'none' : method,
              target: '.item',
              expect: [{ selector: '.item', read: 'aria-ready', equals: 'true' }],
            },
          ]),
          driver,
          expect,
        ),
      ).rejects.toBe(failure)
      expect(getAttribute).not.toHaveBeenCalled()
    },
  )

  it('includes global scope, index and read mode in a failed assertion', async () => {
    vi.stubGlobal('document', { querySelectorAll: () => [element('first'), element('actual')] })
    await expect(
      runContract(
        scenario([
          {
            label: 'read',
            action: 'none',
            expect: [
              { selector: '.portal', global: true, index: 1, read: 'text', equals: 'expected' },
            ],
          },
        ]),
        driverFor({}),
        expect,
      ),
    ).rejects.toThrow('Edge contract › read › .portal (global) [1] text')
  })
})
