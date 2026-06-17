import type { ContractScenario } from '../types'

const BANNER = '[data-iris-banner]'
const CLOSE = '[data-iris-banner-close]'

/**
 * Shared Banner behavior. Mount uncontrolled IrisBanner with `closable=true`.
 * Initially visible; clicking close dismisses it.
 */
export const bannerScenario: ContractScenario = {
  name: 'Banner',
  description:
    'An uncontrolled closable banner starts visible; clicking the close ' + 'button dismisses it.',
  steps: [
    {
      label: 'initial: visible',
      action: 'none',
      expect: [
        { selector: BANNER, read: 'count', equals: 1 },
        { selector: CLOSE, read: 'count', equals: 1 },
      ],
    },
    {
      label: 'click close → dismissed',
      action: 'click',
      target: CLOSE,
      expect: [{ selector: BANNER, read: 'count', equals: 0 }],
    },
  ],
}
