import { IrisSelect } from './primitives/select/Select'

const ITEMS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Apricot', value: 'apricot' },
  { label: 'Grape', value: 'grape' },
]

/** Harness for the Select contract scenario. React Select renders inline by default. */
export function SelectContractHarness() {
  return <IrisSelect items={ITEMS} placeholder="Select fruit" />
}
