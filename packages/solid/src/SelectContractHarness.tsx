import { IrisSelect } from './primitives/select/IrisSelect'

export function SelectContractHarness() {
  return (
    <IrisSelect
      portalTarget={false}
      items={[
        { label: 'Apple', value: 'apple' },
        { label: 'Banana', value: 'banana' },
        { label: 'Apricot', value: 'apricot' },
        { label: 'Grape', value: 'grape' },
      ]}
    />
  )
}
