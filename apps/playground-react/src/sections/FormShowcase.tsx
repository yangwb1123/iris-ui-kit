import { useState } from 'react'
import {
  IrisInput,
  IrisPasswordInput,
  IrisTextarea,
  IrisNumberInput,
  IrisSwitch,
  IrisCheckbox,
  IrisRadio,
  IrisRadioGroup,
  IrisFormField,
  IrisSelect,
  type IrisCheckboxValue,
  IrisFileUpload,
  type IrisFileUploadFile,
} from '@iris-ui/react'

export function FormShowcase() {
  const [name, setName] = useState('Jane Doe')
  const [secret, setSecret] = useState('')
  const [bio, setBio] = useState('')
  const [age, setAge] = useState<number | null>(25)
  const [enabled, setEnabled] = useState(false)
  const [accepted, setAccepted] = useState<IrisCheckboxValue>(false)
  const [fruit, setFruit] = useState<string>('apple')
  const [pick, setPick] = useState<string>('apple')
  const [files, setFiles] = useState<IrisFileUploadFile[]>([])

  return (
    <section className="section">
      <h2 className="section-title">Form Primitives</h2>

      <div className="row">
        <span className="row-label">input</span>
        <IrisFormField label="Name">
          <IrisInput value={name} onChange={(e) => setName(e.target.value)} />
        </IrisFormField>
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>{name}</span>
      </div>

      <div className="row">
        <span className="row-label">password</span>
        <IrisFormField label="Password">
          <IrisPasswordInput value={secret} onChange={(e) => setSecret(e.target.value)} />
        </IrisFormField>
      </div>

      <div className="row">
        <span className="row-label">textarea</span>
        <IrisFormField label="Bio">
          <IrisTextarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
        </IrisFormField>
      </div>

      <div className="row">
        <span className="row-label">number</span>
        <IrisFormField label="Age">
          <IrisNumberInput value={age} onChange={setAge} min={0} max={120} />
        </IrisFormField>
      </div>

      <div className="row">
        <span className="row-label">switch</span>
        <IrisSwitch checked={enabled} onChange={(next) => setEnabled(next)} />
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>{enabled ? 'on' : 'off'}</span>
      </div>

      <div className="row">
        <span className="row-label">checkbox</span>
        <IrisCheckbox checked={accepted} onChange={(next) => setAccepted(next)}>
          I agree to the terms
        </IrisCheckbox>
        <button
          type="button"
          onClick={() => setAccepted(accepted === 'indeterminate' ? false : 'indeterminate')}
          style={{
            padding: '4px 10px',
            background: 'transparent',
            border: '1px solid var(--iris-border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          toggle indeterminate
        </button>
      </div>

      <div className="row">
        <span className="row-label">radio</span>
        <IrisRadioGroup value={fruit} onChange={setFruit} orientation="horizontal">
          <IrisRadio value="apple">Apple</IrisRadio>
          <IrisRadio value="banana">Banana</IrisRadio>
          <IrisRadio value="cherry">Cherry</IrisRadio>
        </IrisRadioGroup>
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>→ {fruit}</span>
      </div>

      <div className="row">
        <span className="row-label">select</span>
        <IrisFormField label="Pick a fruit">
          <IrisSelect
            value={pick}
            onValueChange={setPick}
            items={[
              { value: 'apple', label: 'Apple' },
              { value: 'banana', label: 'Banana' },
              { value: 'cherry', label: 'Cherry' },
              { value: 'durian', label: 'Durian', disabled: true },
            ]}
          />
        </IrisFormField>
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>→ {pick}</span>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">upload</span>
        <IrisFormField label="Attach files" hint="JPG, PNG up to 5MB each. Max 3 files.">
          <IrisFileUpload
            value={files}
            onValueChange={setFiles}
            accept=".jpg,.png,image/jpeg,image/png"
            multiple
            maxFiles={3}
            maxSize={5 * 1024 * 1024}
          />
        </IrisFormField>
      </div>
    </section>
  )
}
