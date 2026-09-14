import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username', exact: true })
  await expect(usernameInput).toBeVisible({ timeout: 10_000 })
  await usernameInput.fill('ada')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

test('query builder — typed recursive rules, validation, and removal', async ({ page }) => {
  await login(page)

  const navigationItem = page.locator('[data-iris-nav-item][data-key="query-builder-example"]')
  await expect(navigationItem).toBeVisible()
  await navigationItem.click()

  const pageRoot = page.locator('[data-page="query-builder-example"]')
  await expect(pageRoot).toBeVisible()
  await expect(
    pageRoot.getByRole('heading', { name: 'Query Builder Example', exact: true }),
  ).toBeVisible()

  const compiledReadout = pageRoot.locator('[data-iris-query-builder-compiled-rules]')
  const recursiveReadout = pageRoot.locator('[data-iris-query-builder-recursive-query]')
  const ruleCountReadout = pageRoot.locator('[data-iris-query-builder-rule-count]')
  const callbackStatusReadout = pageRoot.locator('[data-iris-query-builder-callback-status]')

  await expect(compiledReadout).toHaveText('[]')
  await expect(ruleCountReadout).toHaveText('0')
  await expect(callbackStatusReadout).toHaveText('onChange: received; onQueryChange: received')
  expect(JSON.parse((await recursiveReadout.textContent()) ?? '')).toEqual({
    type: 'group',
    id: 'query-root',
    combinator: 'and',
    children: [],
  })

  const rootGroup = pageRoot.locator('[data-iris-query-group][data-depth="0"]')
  const rootRules = rootGroup.locator(
    ':scope > [data-iris-query-children] > [data-iris-query-rule]',
  )

  await rootGroup.locator('[data-iris-query-add]').click()
  const ageRule = rootRules.first()
  await ageRule.locator('[data-iris-query-column]').selectOption('age')
  await ageRule.locator('[data-iris-query-operator]').selectOption('gte')
  await ageRule.locator('[data-iris-query-value]').fill('30')

  await expect(compiledReadout).toHaveText('[{"key":"age","operator":"gte","value":30}]')
  const compiledAgeRules = JSON.parse((await compiledReadout.textContent()) ?? '') as Array<{
    key: string
    operator: string
    value: unknown
  }>
  expect(compiledAgeRules).toEqual([{ key: 'age', operator: 'gte', value: 30 }])
  expect(typeof compiledAgeRules[0]?.value).toBe('number')

  await rootGroup.locator('[data-iris-query-add-group]').click()
  const nestedGroup = pageRoot.locator('[data-iris-query-group][data-depth="1"]')
  await expect(nestedGroup).toHaveCount(1)
  await expect(nestedGroup).toHaveAttribute('data-depth', '1')
  await nestedGroup.locator('[data-iris-query-combinator]').selectOption('or')
  await nestedGroup.locator('[data-iris-query-add-rule]').click()

  const nestedRule = nestedGroup.locator('[data-iris-query-rule]')
  await nestedRule.locator('[data-iris-query-column]').selectOption('role')
  await nestedRule.locator('[data-iris-query-operator]').selectOption('eq')
  await nestedRule.locator('[data-iris-query-value]').fill('admin')

  await expect(recursiveReadout).toContainText('"key":"role"')
  const recursiveQuery = JSON.parse((await recursiveReadout.textContent()) ?? '') as {
    children: Array<{
      type: string
      combinator?: string
      children?: Array<Record<string, unknown>>
    }>
  }
  const compiledNestedGroup = recursiveQuery.children.find((child) => child.type === 'group')
  expect(compiledNestedGroup).toMatchObject({
    type: 'group',
    combinator: 'or',
    children: [
      {
        type: 'rule',
        key: 'role',
        operator: 'eq',
        value: 'admin',
      },
    ],
  })

  await rootGroup.locator('[data-iris-query-add]').click()
  const invalidRule = rootRules.last()
  const invalidRuleId = await invalidRule.getAttribute('data-node-id')
  expect(invalidRuleId).toBeTruthy()
  await expect(invalidRule.locator('[data-iris-query-value]')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(invalidRule.locator('[data-iris-query-error][role="alert"]')).toHaveText(
    'Name requires a value',
  )

  await invalidRule.locator('[data-iris-query-column]').selectOption('age')
  await invalidRule.locator('[data-iris-query-operator]').selectOption('gte')
  await invalidRule.locator('[data-iris-query-value]').fill('not-a-number')
  await expect(invalidRule.locator('[data-iris-query-value]')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(invalidRule.locator('[data-iris-query-error][role="alert"]')).toHaveText(
    'Age requires finite numbers',
  )

  await invalidRule.locator('[data-iris-query-remove]').click()
  await expect(
    pageRoot.locator(`[data-iris-query-rule][data-node-id="${invalidRuleId}"]`),
  ).toHaveCount(0)
  await expect(pageRoot.locator('[data-iris-query-error][role="alert"]')).toHaveCount(0)

  await expect(ruleCountReadout).toHaveText('2')
  await rootRules.first().locator('[data-iris-query-remove]').click()
  await expect(ruleCountReadout).toHaveText('1')

  const finalRules = JSON.parse((await compiledReadout.textContent()) ?? '')
  expect(finalRules).toEqual([{ key: 'role', operator: 'eq', value: 'admin' }])
  await expect(callbackStatusReadout).toHaveText('onChange: received; onQueryChange: received')
})
