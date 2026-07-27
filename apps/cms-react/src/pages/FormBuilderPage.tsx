import { useState } from 'react'
import { IrisFormBuilder, type FormSchema } from '@iris-ui-kit/plugin-form-builder/react'

const SCHEMA: FormSchema = {
  submitLabel: 'Save Profile',
  fields: [
    {
      name: 'fullName',
      type: 'text',
      label: 'Full Name',
      placeholder: 'e.g. Jane Smith',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      placeholder: 'jane@example.com',
      required: true,
    },
    {
      name: 'password',
      type: 'password',
      label: 'Password',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Role',
      required: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' },
      ],
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Bio',
      placeholder: 'Tell us about yourself…',
    },
    {
      name: 'notify',
      type: 'checkbox',
      label: 'Send email notifications',
      defaultValue: true,
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Skill Tags',
      addLabel: 'Add Skill',
      removeLabel: 'Remove',
      itemLabel: 'Skill',
      fields: [
        { name: 'skill', type: 'text', label: 'Skill', required: true },
        {
          name: 'level',
          type: 'select',
          label: 'Level',
          options: [
            { label: 'Beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Expert', value: 'expert' },
          ],
        },
      ],
    },
  ],
}

/**
 * Form Builder demo page — renders a schema-driven form using
 * `@iris-ui-kit/plugin-form-builder`. Demonstrates multi-field types,
 * conditional validation, array (repeater) fields, and the core form engine.
 */
export function FormBuilderPage() {
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null)

  return (
    <div data-page="form-builder" style={{ maxWidth: 600 }}>
      <h2 style={{ margin: '0 0 4px' }}>Form Builder</h2>
      <p style={{ margin: '0 0 20px', color: 'var(--iris-muted)', fontSize: 14 }}>
        Schema-driven form powered by <code>@iris-ui-kit/plugin-form-builder</code>.
      </p>

      <IrisFormBuilder
        schema={SCHEMA}
        onSubmit={(values) => {
          setSubmitted(values as Record<string, unknown>)
        }}
        validateOnChange
      />

      {submitted && (
        <div
          data-testid="submitted-values"
          style={{
            marginTop: 24,
            padding: 16,
            background: 'var(--iris-surface)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            border: '1px solid var(--iris-border)',
          }}
        >
          <h4 style={{ margin: '0 0 8px' }}>Submitted Values</h4>
          <pre
            style={{
              margin: 0,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              color: 'var(--iris-foreground)',
            }}
          >
            {JSON.stringify(submitted, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
