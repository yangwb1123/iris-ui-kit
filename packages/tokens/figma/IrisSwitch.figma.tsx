/**
 * Figma Code Connect — IrisSwitch. A template like IrisButton.figma.tsx: it maps
 * a Figma "Switch" component's properties to the React `IrisSwitch` code an
 * engineer should copy. Outside `src/`, so it never enters the library build
 * (`@figma/code-connect` is a tooling-only dependency). Publish with the Code
 * Connect CLI (`npx figma connect publish`, reads ../figma.config.json).
 *
 * Replace <FIGMA_SWITCH_NODE_URL> with your Figma Switch component's node URL,
 * and make the Figma property names ('Checked', 'Disabled', 'Size') match.
 */
// @ts-nocheck
import figma from '@figma/code-connect'
import { IrisSwitch } from '@iris-ui-kit/react'

figma.connect(IrisSwitch, '<FIGMA_SWITCH_NODE_URL>', {
  props: {
    checked: figma.boolean('Checked'),
    disabled: figma.boolean('Disabled'),
    size: figma.enum('Size', {
      Small: 'sm',
      Medium: 'md',
      Large: 'lg',
    }),
  },
  example: ({ checked, disabled, size }) => (
    <IrisSwitch checked={checked} disabled={disabled} size={size} />
  ),
})
