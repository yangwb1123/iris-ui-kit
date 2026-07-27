/**
 * Figma Code Connect — IrisButton.
 *
 * This is a Code Connect *template*: it maps a Figma "Button" component's
 * variant properties to the React `IrisButton` code an engineer should copy.
 * It is intentionally OUTSIDE `src/` so it is never type-checked, linted, or
 * bundled (it imports `@figma/code-connect`, a tooling-only dependency that the
 * library does not ship). Publish it with the Code Connect CLI:
 *
 *   npm i -D @figma/code-connect
 *   npx figma connect publish   # reads figma.config.json
 *
 * Replace <FIGMA_BUTTON_NODE_URL> with the URL of your Figma Button component
 * (right-click the component → Copy link to selection). Figma variant/property
 * names ('Variant', 'Size', 'Disabled', 'Label') must match your component.
 *
 * The accompanying design-token round-trip (DTCG → Figma Variables / Tokens
 * Studio) is documented in ../TOKENS_INTEROP.md.
 */
// @ts-nocheck
import figma from '@figma/code-connect'
import { IrisButton } from '@iris-ui-kit/react'

figma.connect(IrisButton, '<FIGMA_BUTTON_NODE_URL>', {
  props: {
    variant: figma.enum('Variant', {
      Solid: 'solid',
      Outline: 'outline',
      Ghost: 'ghost',
      Link: 'link',
    }),
    size: figma.enum('Size', {
      Small: 'sm',
      Medium: 'md',
      Large: 'lg',
    }),
    disabled: figma.boolean('Disabled'),
    label: figma.string('Label'),
  },
  example: ({ variant, size, disabled, label }) => (
    <IrisButton variant={variant} size={size} disabled={disabled}>
      {label}
    </IrisButton>
  ),
})
