<script setup lang="ts">
import { ref } from 'vue'
import { IrisSelect, IrisTable, type IrisListItem, type IrisTableColumn } from '@iris-ui-kit/vue'

const fruitOptions: IrisListItem<string>[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian', disabled: true },
  { value: 'elderberry', label: 'Elderberry' },
]
const selected = ref<string | null>('banana')

interface User extends Record<string, unknown> {
  id: number
  name: string
  role: string
  age: number
}

const users: User[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', age: 36 },
  { id: 2, name: 'Grace Hopper', role: 'Admiral', age: 85 },
  { id: 3, name: 'Alan Turing', role: 'Cryptanalyst', age: 41 },
  { id: 4, name: 'Linus Torvalds', role: 'Kernel hacker', age: 54 },
]

const columns: IrisTableColumn<Record<string, unknown>>[] = [
  { key: 'name', title: 'Name', sortable: true, width: 220 },
  { key: 'role', title: 'Role', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right', width: 80 },
]

const selectedRows = ref<Array<string | number>>([])
</script>

<template>
  <section class="section">
    <h2 class="section-title">Data — Select &amp; Table</h2>

    <div class="row">
      <span class="row-label">select</span>
      <IrisSelect v-model="selected" :items="fruitOptions" placeholder="Pick a fruit" />
      <span style="font-size: 12px; color: var(--iris-muted)">→ {{ selected ?? '(none)' }}</span>
    </div>

    <div class="block">
      <span class="row-label">table</span>
      <IrisTable
        :columns="columns"
        :data="users"
        row-key="id"
        selectable="multi"
        striped
        v-model:selection="selectedRows"
      >
        <template #cell.name="{ value }">
          <strong>{{ value }}</strong>
        </template>
      </IrisTable>
      <span style="font-size: 12px; color: var(--iris-muted)">
        Selected ids: {{ selectedRows.length ? selectedRows.join(', ') : '(none)' }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: var(--iris-gap-md);
  flex-wrap: wrap;
}
.block {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-md);
}
.row-label {
  width: 72px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
