<script lang="ts">
  import {
    operatorLabels,
    type FilterBuilder,
    type FilterOperator,
    type FilterRule,
    type FilterBuilderState,
  } from '../core'

  let {
    builder,
    onChange,
    addLabel = 'Add rule',
    class: klass = '',
  }: {
    builder: FilterBuilder
    /** Called with the compiled `FilterRule[]` whenever the rules change. */
    onChange?: (rules: FilterRule[]) => void
    /** Label for the add-rule button. Default `'Add rule'`. */
    addLabel?: string
    class?: string
  } = $props()

  // Bridge the core Store directly into a rune (NB: do not name it `state` — a
  // leading `$` would make Svelte read `$state` as a store auto-subscription).
  // svelte-ignore state_referenced_locally
  let qbState: FilterBuilderState = $state(builder.getState())

  $effect(() => builder.subscribe((s) => (qbState = s)))

  // Emit the compiled FilterRule[] whenever the rules change.
  $effect(() => {
    // read qbState so this effect re-runs on every store update
    void qbState
    onChange?.(builder.toFilterRules())
  })
</script>

<div data-iris-query-builder class={klass}>
  {#each qbState.rules as rule (rule.id)}
    <div data-iris-query-rule>
      <select
        data-iris-query-column
        value={rule.key}
        aria-label="Column"
        onchange={(e) => builder.updateRule(rule.id, { key: e.currentTarget.value })}
      >
        {#each builder.columns as c (c.key)}
          <option value={c.key}>{c.label}</option>
        {/each}
      </select>
      <select
        data-iris-query-operator
        value={rule.operator}
        aria-label="Operator"
        onchange={(e) =>
          builder.updateRule(rule.id, { operator: e.currentTarget.value as FilterOperator })}
      >
        {#each builder.operatorsFor(rule.key) as op (op)}
          <option value={op}>{operatorLabels[op]}</option>
        {/each}
      </select>
      <input
        data-iris-query-value
        value={rule.value}
        aria-label="Value"
        oninput={(e) => builder.updateRule(rule.id, { value: e.currentTarget.value })}
      />
      <button
        type="button"
        data-iris-query-remove
        aria-label="Remove rule"
        onclick={() => builder.removeRule(rule.id)}
      >
        ×
      </button>
    </div>
  {/each}
  <button type="button" data-iris-query-add onclick={() => builder.addRule()}>
    {addLabel}
  </button>
</div>
