import { IrisMenu, IrisMenuTrigger, IrisMenuContent, IrisMenuItem } from './primitives/menu'

/** Harness for the Menu contract scenario. portalTarget={false} keeps content inline. */
export function MenuContractHarness() {
  return (
    <IrisMenu>
      <IrisMenuTrigger>Menu</IrisMenuTrigger>
      <IrisMenuContent portalTarget={false}>
        <IrisMenuItem onSelect={() => {}}>Item 1</IrisMenuItem>
        <IrisMenuItem onSelect={() => {}}>Item 2</IrisMenuItem>
        <IrisMenuItem onSelect={() => {}}>Item 3</IrisMenuItem>
      </IrisMenuContent>
    </IrisMenu>
  )
}
