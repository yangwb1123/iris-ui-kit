<script lang="ts">
  import {
    defaultQueryBuilderLabels,
    operatorLabels,
    type CompiledQueryGroup,
    type FilterBuilder,
    type FilterOperator,
    type FilterRule,
    type FilterBuilderState,
    type QueryBuilderLabels,
    type QueryGroup,
    type QueryRuleNode,
    type QueryValidationIssue,
  } from '@iris-ui-kit/plugin-query-builder/core'

  let {
    builder,
    onChange,
    onQueryChange,
    addLabel,
    labels,
    class: klass = '',
  }: {
    builder: FilterBuilder
    onChange?: (rules: FilterRule[]) => void
    onQueryChange?: (query: CompiledQueryGroup) => void
    addLabel?: string
    labels?: Partial<QueryBuilderLabels>
    class?: string
  } = $props()

  // svelte-ignore state_referenced_locally
  let qbState: FilterBuilderState = $state(builder.getState())

  $effect(() => builder.subscribe((s) => (qbState = s)))

  const copy = $derived({
    ...defaultQueryBuilderLabels,
    ...labels,
    ...(addLabel === undefined ? {} : { addRule: addLabel }),
  })
  const issues = $derived.by(() => {
    void qbState
    return builder.validate().issues
  })
  const issuesFor = (id: string): QueryValidationIssue[] =>
    issues.filter((issue) => issue.nodeId === id)

  $effect(() => {
    void qbState
    onChange?.(builder.toFilterRules())
    onQueryChange?.(builder.toQuery())
  })
</script>

{#snippet renderRule(rule: QueryRuleNode)}
  {@const ruleIssues = issuesFor(rule.id)}
  {@const invalid = ruleIssues.length > 0}
  {@const errorId = `${rule.id}-error`}
  <div data-iris-query-rule data-node-id={rule.id}>
    <select
      data-iris-query-column
      value={rule.key}
      aria-label={copy.column}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      onchange={(event) => builder.updateRule(rule.id, { key: event.currentTarget.value })}
    >
      {#each builder.columns as column (column.key)}
        <option value={column.key}>{column.label}</option>
      {/each}
    </select>
    <select
      data-iris-query-operator
      value={rule.operator}
      aria-label={copy.operator}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      onchange={(event) =>
        builder.updateRule(rule.id, {
          operator: event.currentTarget.value as FilterOperator,
        })}
    >
      {#each builder.operatorsFor(rule.key) as operator (operator)}
        <option value={operator}>{operatorLabels[operator]}</option>
      {/each}
    </select>
    <input
      data-iris-query-value
      value={rule.value}
      aria-label={copy.value}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      oninput={(event) => builder.updateRule(rule.id, { value: event.currentTarget.value })}
    />
    <button
      type="button"
      data-iris-query-remove
      aria-label={copy.removeRule}
      onclick={() => builder.removeRule(rule.id)}
    >
      ×
    </button>
    {#if invalid}
      <span id={errorId} data-iris-query-error role="alert">
        {ruleIssues.map((issue) => issue.message).join('. ')}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet renderGroup(group: QueryGroup, depth: number, root = false)}
  <fieldset data-iris-query-group data-group-id={group.id} data-depth={depth}>
    <legend>{root ? copy.rootGroup : copy.nestedGroup}</legend>
    <label>
      <span>{copy.combinator}</span>
      <select
        data-iris-query-combinator
        value={group.combinator}
        aria-label={`${copy.combinator}: ${root ? copy.rootGroup : copy.nestedGroup}`}
        onchange={(event) =>
          builder.updateGroup(group.id, {
            combinator: event.currentTarget.value as QueryGroup['combinator'],
          })}
      >
        <option value="and">{copy.matchAll}</option>
        <option value="or">{copy.matchAny}</option>
      </select>
    </label>
    <div data-iris-query-children>
      {#each group.children as node (node.id)}
        {#if node.type === 'group'}
          {@render renderGroup(node, depth + 1)}
        {:else}
          {@render renderRule(node)}
        {/if}
      {/each}
    </div>
    <div data-iris-query-group-actions>
      <button
        type="button"
        data-iris-query-add-rule
        data-iris-query-add={root ? '' : undefined}
        onclick={() => builder.addRule(group.id)}
      >
        {copy.addRule}
      </button>
      <button type="button" data-iris-query-add-group onclick={() => builder.addGroup(group.id)}>
        {copy.addGroup}
      </button>
      {#if !root}
        <button
          type="button"
          data-iris-query-remove-group
          aria-label={copy.removeGroup}
          onclick={() => builder.removeGroup(group.id)}
        >
          {copy.removeGroup}
        </button>
      {/if}
    </div>
  </fieldset>
{/snippet}

<div data-iris-query-builder class={klass}>
  {@render renderGroup(qbState.root, 0, true)}
</div>
