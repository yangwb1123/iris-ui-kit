import { describe, expect, it } from 'vitest'
import { generateFormSchema } from './tools'

describe('generateFormSchema', () => {
  it('generates React code from field descriptors', () => {
    const result = generateFormSchema([
      { name: 'name', type: 'text', required: true },
      { name: 'email', type: 'email' },
    ])
    expect(result.react).toContain('IrisFormBuilder')
    expect(result.react).toContain('"required": true')
    expect(result.schema.submitLabel).toBe('Submit')
  })

  it('generates Vue code from field descriptors', () => {
    const result = generateFormSchema([{ name: 'name', label: 'Full Name', type: 'text' }])
    expect(result.vue).toContain('IrisFormBuilder')
    expect(result.vue).toContain(':schema')
  })

  it('handles select fields with options', () => {
    const result = generateFormSchema([
      { name: 'role', type: 'select', options: [{ label: 'Admin', value: 'admin' }] },
    ])
    expect(result.react).toContain('Admin')
    expect(result.react).toContain('admin')
  })

  it('handles custom submitLabel', () => {
    const result = generateFormSchema([], { submitLabel: 'Save' })
    expect(result.schema.submitLabel).toBe('Save')
  })

  it('handles array fields with sub-fields', () => {
    const result = generateFormSchema([
      {
        name: 'tags',
        type: 'array',
        addLabel: 'Add Skill',
        fields: [{ name: 'name', type: 'text', required: true }],
      },
    ])
    expect(result.react).toContain('array')
    expect(result.react).toContain('"addLabel": "Add Skill"')
  })

  it('is deterministic (same input → same output)', () => {
    const input = [{ name: 'x', type: 'text' }]
    expect(generateFormSchema(input)).toEqual(generateFormSchema(input))
  })
})
