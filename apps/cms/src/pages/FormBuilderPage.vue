<template>
  <div data-page="form-builder" style="max-width: 600px">
    <h2 style="margin: 0 0 4px">Form Builder</h2>
    <p style="margin: 0 0 20px; color: var(--iris-muted); font-size: 14px">
      Schema-driven form powered by <code>@iris-ui-kit/plugin-form-builder</code>.
    </p>

    <IrisFormBuilder :schema="schema" :on-submit="handleSubmit" :validate-on-change="true" />

    <div
      v-if="submitted"
      data-testid="submitted-values"
      style="
        margin-top: 24px;
        padding: 16px;
        background: var(--iris-surface);
        border-radius: var(--iris-radius-md, 6px);
        border: 1px solid var(--iris-border);
      "
    >
      <h4 style="margin: 0 0 8px">Submitted Values</h4>
      <pre
        style="margin: 0; font-size: 13px; white-space: pre-wrap; color: var(--iris-foreground)"
        >{{ JSON.stringify(submitted, null, 2) }}</pre
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IrisFormBuilder, type FormSchema } from '@iris-ui-kit/plugin-form-builder/vue'

const schema: FormSchema = {
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
    { name: 'password', type: 'password', label: 'Password', required: true },
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
    { name: 'bio', type: 'textarea', label: 'Bio', placeholder: 'Tell us about yourself…' },
    { name: 'notify', type: 'checkbox', label: 'Send email notifications', defaultValue: true },
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

const submitted = ref<Record<string, unknown> | null>(null)

function handleSubmit(values: Record<string, unknown>) {
  submitted.value = values
}
</script>
