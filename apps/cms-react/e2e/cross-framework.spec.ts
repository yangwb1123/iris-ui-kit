import { test, expect, type Locator, type Page } from '@playwright/test'

/**
 * The same production journey runs against all four CMS adapters. Unit and
 * contract suites catch component-level divergence; this catches app wiring
 * failures that only exist in a real bundle/browser (auth persistence, nested
 * navigation, resource rendering and localStorage-backed settings).
 */

async function login(page: Page, username = 'ada', assertNoRolePicker = false): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible()
  await usernameInput.fill(username)
  if (assertNoRolePicker) {
    // Role assignment belongs to the auth response, not client-editable login UI.
    await expect(page.getByRole('combobox')).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function openUsers(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Users', exact: true }).click()
  await page.getByRole('button', { name: 'All users', exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
}

async function openSettings(page: Page): Promise<void> {
  const settings = page.getByRole('button', { name: 'Settings', exact: true })
  if ((await settings.count()) === 0) {
    await page.getByRole('button', { name: 'Admin', exact: true }).click()
  }
  await settings.click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

type WorkspaceRoute =
  'articles' | 'categories' | 'media' | 'roles' | 'overview' | 'reports' | 'calendar' | 'audit-log'

interface WorkspaceNavigation {
  route: WorkspaceRoute
  parent?: 'content' | 'users' | 'analytics' | 'admin'
  heading: string
}

async function openWorkspace(
  page: Page,
  { route, parent, heading }: WorkspaceNavigation,
): Promise<Locator> {
  const navigation = page.locator('[data-iris-nav-menu]')
  const destination = navigation.locator(`[data-iris-nav-item][data-key="${route}"]`)

  if (!(await destination.isVisible()) && parent) {
    const section = navigation.locator(`[data-iris-nav-item][data-key="${parent}"]`)
    if ((await section.getAttribute('aria-expanded')) !== 'true') {
      await section.click()
    }
  }

  await destination.click()
  const workspace = page.locator(`[data-cms-workspace="${route}"]`)
  await expect(workspace).toBeVisible()
  await expect(workspace.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  return workspace
}

test('admin login → users data → persisted settings', async ({ page }) => {
  await login(page)
  await openUsers(page)

  const rows = page.getByRole('table').getByRole('row')
  await expect.poll(() => rows.count()).toBeGreaterThan(1)

  await page.evaluate(() => window.localStorage.removeItem('iris-cms-settings'))
  await openSettings(page)

  const fieldset = page.locator('[data-iris-fieldset]')
  await expect(fieldset).toHaveCount(1)
  expect(await fieldset.evaluate((element) => element.tagName.toLowerCase())).toBe('fieldset')

  const legend = fieldset.locator('[data-iris-fieldset-legend]')
  await expect(legend).toBeVisible()
  await expect(legend).toHaveText('Site settings')
  const hint = fieldset.locator('[data-iris-fieldset-hint]')
  await expect(hint).toBeVisible()
  await expect(hint).toHaveText('These settings apply to the entire site.')

  const siteNameInput = fieldset.getByRole('textbox', { name: 'Site name', exact: true })
  const supportEmailInput = fieldset.getByRole('textbox', {
    name: 'Support email',
    exact: true,
  })
  await expect(fieldset).toHaveJSProperty('disabled', false)
  await expect(siteNameInput).toBeEnabled()
  await expect(supportEmailInput).toBeEnabled()

  const lockSettings = page.getByRole('button', { name: 'Lock settings', exact: true })
  await expect(lockSettings).toBeVisible()
  await expect(lockSettings).toBeEnabled()
  await expect(fieldset.getByRole('button', { name: 'Lock settings', exact: true })).toHaveCount(0)

  await lockSettings.click()
  await expect(fieldset).toHaveJSProperty('disabled', true)
  await expect(siteNameInput).toBeDisabled()
  await expect(supportEmailInput).toBeDisabled()

  const unlockSettings = page.getByRole('button', { name: 'Unlock settings', exact: true })
  await expect(unlockSettings).toBeVisible()
  await expect(unlockSettings).toBeEnabled()
  await expect(fieldset.getByRole('button', { name: 'Unlock settings', exact: true })).toHaveCount(
    0,
  )

  await unlockSettings.click()
  await expect(fieldset).toHaveJSProperty('disabled', false)
  await expect(siteNameInput).toBeEnabled()
  await expect(supportEmailInput).toBeEnabled()

  const environment = page.getByRole('radiogroup', { name: 'Environment', exact: true })
  await expect(environment).toBeVisible()
  const environmentOptions = environment.getByRole('radio')
  await expect(environmentOptions).toHaveCount(3)
  await expect(environmentOptions.nth(0)).toHaveAccessibleName('Live')
  await expect(environmentOptions.nth(1)).toHaveAccessibleName('Maintenance')
  await expect(environmentOptions.nth(2)).toHaveAccessibleName('Read-only preview')

  const live = environment.getByRole('radio', { name: 'Live', exact: true })
  const maintenance = environment.getByRole('radio', { name: 'Maintenance', exact: true })
  const preview = environment.getByRole('radio', { name: 'Read-only preview', exact: true })
  await expect(live).toHaveAttribute('aria-checked', 'true')
  await expect(maintenance).toHaveAttribute('aria-checked', 'false')
  await expect(preview).toHaveAttribute('aria-checked', 'false')
  await expect(live).not.toBeDisabled()
  await expect(maintenance).not.toBeDisabled()
  await expect(preview).toBeDisabled()

  await live.press('ArrowRight')
  await expect(maintenance).toHaveAttribute('aria-checked', 'true')
  await maintenance.press('Home')
  await expect(live).toHaveAttribute('aria-checked', 'true')
  await live.press('End')
  await expect(maintenance).toHaveAttribute('aria-checked', 'true')
  await expect(preview).toHaveAttribute('aria-checked', 'false')

  await preview.click({ force: true })
  await expect(maintenance).toHaveAttribute('aria-checked', 'true')

  await maintenance.press('Home')
  await expect(live).toHaveAttribute('aria-checked', 'true')
  await maintenance.click()
  await expect(maintenance).toHaveAttribute('aria-checked', 'true')

  const siteName = page.getByRole('textbox', { name: 'Site name' })
  await siteName.fill('Iris Cross-framework CMS')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toHaveText('Settings saved.')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await openSettings(page)
  const persistedEnvironment = page.getByRole('radiogroup', { name: 'Environment', exact: true })
  await expect(
    persistedEnvironment.getByRole('radio', { name: 'Maintenance', exact: true }),
  ).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('textbox', { name: 'Site name' })).toHaveValue(
    'Iris Cross-framework CMS',
  )
})

test('admin can navigate and operate every real CMS workspace', async ({ page }, testInfo) => {
  await login(page)

  const articles = await openWorkspace(page, {
    route: 'articles',
    parent: 'content',
    heading: 'Articles',
  })
  const articleSearch = articles.getByRole('searchbox', { name: 'Search Articles' })
  await articleSearch.fill('token migration')
  await expect(
    articles.getByRole('row').filter({ hasText: 'Token migration playbook' }),
  ).toBeVisible()
  await expect(
    articles.getByRole('row').filter({ hasText: 'Designing an AI-native UI' }),
  ).toHaveCount(0)
  await articleSearch.fill('')

  const categories = await openWorkspace(page, {
    route: 'categories',
    parent: 'content',
    heading: 'Categories',
  })
  const emptyCategory = categories.getByRole('row').filter({ hasText: 'Field notes' })
  await emptyCategory.getByRole('button', { name: 'Add article', exact: true }).click()
  await expect(categories.getByRole('status')).toHaveText('Attached an article to Field notes.')
  await expect(emptyCategory).toContainText('1')
  await expect(emptyCategory).toContainText('Active')

  const media = await openWorkspace(page, {
    route: 'media',
    parent: 'content',
    heading: 'Media library',
  })
  await media.getByRole('combobox', { name: 'Filter Media library' }).selectOption('Video')
  await expect(media.getByRole('row').filter({ hasText: 'product-tour.mp4' })).toBeVisible()
  await expect(media.getByRole('row').filter({ hasText: 'hero-dashboard.webp' })).toHaveCount(0)

  const roles = await openWorkspace(page, {
    route: 'roles',
    parent: 'users',
    heading: 'Roles & access',
  })
  await roles.getByRole('button', { name: 'Create role', exact: true }).click()
  await expect(roles.getByRole('status')).toHaveText('Created “Custom role 4” with limited access.')
  await expect(roles.getByRole('row').filter({ hasText: 'Custom role 4' })).toBeVisible()

  const overview = await openWorkspace(page, {
    route: 'overview',
    parent: 'analytics',
    heading: 'Analytics overview',
  })
  const metrics = overview.getByLabel('Current metrics')
  await expect(metrics.getByText('24.8k', { exact: true })).toBeVisible()
  await overview.getByRole('button', { name: 'Refresh metrics', exact: true }).click()
  await expect(metrics.getByText('25.2k', { exact: true })).toBeVisible()
  await expect(overview.getByRole('status')).toHaveText(
    'Analytics metrics refreshed from the demo data source.',
  )

  const reports = await openWorkspace(page, {
    route: 'reports',
    parent: 'analytics',
    heading: 'Reports',
  })
  const executiveReport = reports.getByRole('row').filter({ hasText: 'Executive summary' })
  await executiveReport.getByRole('button', { name: 'Run now', exact: true }).click()
  await expect(reports.getByRole('status')).toHaveText('Queued “Executive summary” to run now.')
  await expect(executiveReport).toContainText('Queued now')
  await expect(executiveReport).toContainText('Running')

  const calendar = await openWorkspace(page, {
    route: 'calendar',
    heading: 'Calendar',
  })
  const period = calendar.getByLabel('Calendar period')
  await expect(period).toContainText('July 2026')
  await period.getByRole('button', { name: 'Next period' }).click()
  await expect(period).toContainText('August 2026')
  await calendar.getByRole('button', { name: 'Add event', exact: true }).click()
  await expect(calendar.getByRole('status')).toHaveText('Added “Editorial event 4” to August 2026.')
  await expect(calendar.getByRole('row').filter({ hasText: 'Editorial event 4' })).toBeVisible()

  const hasExtendedAdmin =
    testInfo.project.name === 'chromium' || testInfo.project.name === 'svelte'
  const adminNavigation = page
    .locator('[data-iris-nav-menu]')
    .locator('[data-iris-nav-item][data-key="admin"]')
  await expect(adminNavigation).toHaveCount(hasExtendedAdmin ? 1 : 0)

  if (hasExtendedAdmin) {
    const auditLog = await openWorkspace(page, {
      route: 'audit-log',
      parent: 'admin',
      heading: 'Audit log',
    })
    await auditLog.getByRole('combobox', { name: 'Filter Audit log' }).selectOption('Attention')
    await expect(
      auditLog.getByRole('row').filter({ hasText: 'Blocked repeated login' }),
    ).toBeVisible()
    await auditLog.getByRole('button', { name: 'Export visible', exact: true }).click()
    await expect(auditLog.getByRole('status')).toHaveText('Exported 1 visible audit events.')
  }
})

test('viewer role comes from auth and cannot see privileged navigation', async ({ page }) => {
  await login(page, 'viewer', true)

  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Admin', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Users', exact: true }).click()
  await expect(page.getByRole('button', { name: 'All users', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Roles & access', exact: true })).toHaveCount(0)
})

test('VxeGrid Example — controlled column visibility across framework bundles', async ({
  page,
}, testInfo) => {
  await login(page)
  if (testInfo.project.name === 'chromium') {
    await page.goto('/#vxe-example')
  } else {
    await page.locator('[data-iris-nav-item][data-key="vxe-example"]').click()
  }

  const section = page.locator('[data-iris-vxe-section="column-visibility"]')
  const table = section.locator('[data-iris-table]')
  const readout = section.locator('[data-iris-vxe-visibility-readout]')
  const statusToggle = section.locator('[data-iris-vxe-visibility-toggle="status"]')
  const roleToggle = section.locator('[data-iris-vxe-visibility-toggle="role"]')
  const bodyRows = table.locator(
    '[role="row"]:not([data-iris-table-row="header"]):not([data-iris-table-row="summary"])',
  )
  const headerKeys = () =>
    table
      .locator('[data-iris-table-header]')
      .evaluateAll((headers) =>
        headers.map((header) => header.getAttribute('data-iris-table-header') ?? ''),
      )

  await expect(section).toHaveCount(1)
  await expect(
    section.getByRole('heading', {
      name: '受控列可见性（Controlled column visibility）',
      exact: true,
    }),
  ).toBeVisible()
  await expect(table).toHaveCount(1)
  await expect(table).toBeVisible()
  await expect.poll(headerKeys).toEqual(['name', 'role'])
  await expect(readout).toHaveText('visible: ["name","role"]')
  await expect(table.locator('[data-iris-table-header="status"]')).toHaveCount(0)
  await expect(table.locator('[data-iris-table-cell="status"]')).toHaveCount(0)
  await expect(table.locator('[data-iris-table-cell="name"]')).toHaveText(['Alice', 'Bob'])
  await expect(table.locator('[data-iris-table-cell="role"]')).toHaveText(['Admin', 'Editor'])
  await expect(statusToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(roleToggle).toHaveAttribute('aria-pressed', 'true')
  const initialRowCount = await bodyRows.count()
  expect(initialRowCount).toBe(2)

  await statusToggle.click()
  await expect(statusToggle).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(headerKeys).toEqual(['name', 'role', 'status'])
  await expect(readout).toHaveText('visible: ["name","role","status"]')
  await expect(table.locator('[data-iris-table-cell="status"]')).toHaveText(['active', 'paused'])
  await expect(table.locator('[data-iris-table-cell="name"]')).toHaveText(['Alice', 'Bob'])
  await expect(table.locator('[data-iris-table-cell="role"]')).toHaveText(['Admin', 'Editor'])

  await roleToggle.click()
  await expect(roleToggle).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(headerKeys).toEqual(['name', 'status'])
  await expect(readout).toHaveText('visible: ["name","status"]')
  await expect(table.locator('[data-iris-table-header="role"]')).toHaveCount(0)
  await expect(table.locator('[data-iris-table-cell="role"]')).toHaveCount(0)
  await expect(table.locator('[data-iris-table-cell="name"]')).toHaveText(['Alice', 'Bob'])
  await expect(table.locator('[data-iris-table-cell="status"]')).toHaveText(['active', 'paused'])
  await expect(bodyRows).toHaveCount(initialRowCount)
})

test('VxeGrid Example — context menu across framework bundles', async ({ page }, testInfo) => {
  await login(page)
  if (testInfo.project.name === 'chromium') {
    await page.goto('/#vxe-example')
  } else {
    await page.locator('[data-iris-nav-item][data-key="vxe-example"]').click()
  }

  const section = page.locator('[data-iris-vxe-section="context-menu"]')
  const table = section.locator('[data-iris-table]')
  const leafHeaders = table.locator('[data-iris-table-header]:not([data-iris-table-header-group])')
  const bodyRows = table.locator(
    '[data-iris-table-row-key], [data-iris-table-row]:not([data-iris-table-row="header"]):not([data-iris-table-row="summary"])',
  )
  const readout = section.locator('[data-iris-vxe-context-menu-readout]')
  const menu = page.locator('[data-iris-table-context-menu]')
  const rowByKey = (key: string) =>
    table.locator(`[data-iris-table-row="${key}"], [data-iris-table-row-key="${key}"]`)
  const headerSnapshot = () =>
    leafHeaders.evaluateAll((headers) =>
      headers.map((header) => ({
        key: header.getAttribute('data-iris-table-header') ?? '',
        title: header.textContent?.trim() ?? '',
      })),
    )
  const bodyRowKeys = () =>
    bodyRows.evaluateAll((rows) =>
      rows.map(
        (row) =>
          row.getAttribute('data-iris-table-row-key') ??
          row.getAttribute('data-iris-table-row') ??
          '',
      ),
    )

  await expect(section).toHaveCount(1)
  await expect(section).toBeVisible()
  await expect(
    section.getByRole('heading', { name: 'VxeGrid body-cell context menu', exact: true }),
  ).toBeVisible()
  await expect(table).toHaveCount(1)
  await expect(table).toBeVisible()
  await expect(leafHeaders).toHaveCount(2)
  await expect.poll(headerSnapshot).toEqual([
    { key: 'name', title: 'Name' },
    { key: 'status', title: 'Status' },
  ])
  await expect(bodyRows).toHaveCount(3)
  await expect.poll(bodyRowKeys).toEqual(['61001', '61002', '61003'])
  await expect(readout).toHaveText('No action yet')

  const nameHeader = table.locator('[data-iris-table-header="name"]')
  const targetRow = rowByKey('61002')
  const targetCell = targetRow.locator('[data-iris-table-cell="status"]')
  await expect(targetRow).toHaveCount(1)
  await expect(targetCell).toHaveCount(1)
  await targetCell.scrollIntoViewIfNeeded()

  await targetCell.click({ button: 'right' })
  await expect(menu).toHaveCount(1)
  await expect(menu).toHaveAttribute('role', 'menu')
  for (const [key, label] of [
    ['inspect', 'Inspect'],
    ['open', 'Open'],
  ] as const) {
    const item = menu.locator(`[data-iris-table-context-menu-item="${key}"]`)
    await expect(item).toHaveCount(1)
    await expect(item).toHaveAttribute('role', 'menuitem')
    await expect(item).toHaveAccessibleName(label)
    await expect(item).not.toBeDisabled()
  }

  await menu.locator('[data-iris-table-context-menu-item="inspect"]').click()
  await expect(readout).toHaveAttribute('aria-live', 'polite')
  await expect(readout).toHaveText('Last action: inspect row 61002 column status')
  await expect(menu).toHaveCount(0)

  await nameHeader.click({ button: 'right' })
  await expect(menu).toHaveCount(0)

  await targetCell.click({ button: 'right' })
  await expect(menu).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  await targetCell.click({ button: 'right' })
  await expect(menu).toHaveCount(1)
  await nameHeader.click()
  await expect(menu).toHaveCount(0)
})

test('dashboard renders deterministic IrisCountdown release example across framework bundles', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const frozenNow = 1_700_000_000_000
    Date.now = () => frozenNow
  })
  await login(page)

  const example = page.locator('[data-iris-countdown-example="dashboard-release"]')
  await expect(example).toHaveCount(1)
  const countdowns = example.locator('[data-iris-countdown]')
  await expect(countdowns).toHaveCount(3)

  const release = countdowns.nth(0)
  await expect(release.locator('[data-iris-countdown-time]')).toHaveText('01 01:01:01')
  await expect(release.locator('[data-iris-countdown-title]')).toHaveText('Next release')
  await expect(release).toContainText('T-')
  await expect(release).toContainText('until launch')
  await expect(release.locator('[data-iris-countdown-value]')).toHaveCSS('font-size', '18px')

  const precision = countdowns.nth(1)
  await expect(precision.locator('[data-iris-countdown-time]')).toHaveText('12.345')
  await expect(precision.locator('[data-iris-countdown-title]')).toHaveText('Millisecond precision')
  await expect(precision.locator('[data-iris-countdown-value]')).toHaveCSS('font-size', '24px')

  const expired = countdowns.nth(2)
  await expect(expired.locator('[data-iris-countdown-time]')).toHaveText('00:00:00')
  await expect(expired.locator('[data-iris-countdown-title]')).toHaveText('Expired release')
  await expect(expired.locator('[data-iris-countdown-value]')).toHaveCSS('font-size', '30px')
  await expect(expired).toHaveAttribute('data-finished', 'true')

  const finishCount = example.locator('[data-iris-countdown-finish-count]')
  await expect(finishCount).toHaveText('1')
  await page.waitForTimeout(1_100)
  await expect(finishCount).toHaveText('1')
})

test('IrisLongPress dashboard sample across framework bundles', async ({ page }) => {
  await login(page)

  const section = page.locator('[data-iris-dashboard-section="long-press"]')
  const enabled = section.locator('[data-iris-long-press-target="enabled"]')
  const disabled = section.locator('[data-iris-long-press-target="disabled"]')
  const readout = section.locator('[data-iris-long-press-readout]')
  const count = section.locator('[data-iris-long-press-count]')
  const action = section.locator('[data-iris-long-press-action]')

  await expect(section).toHaveCount(1)
  await expect(enabled).toHaveCount(1)
  await expect(disabled).toHaveCount(1)
  await expect(readout).toHaveAttribute('aria-live', 'polite')
  await expect(readout).toHaveText('Long-press count: 0; Last action: none')
  await expect(count).toHaveText('0')
  await expect(action).toHaveText('none')

  await enabled.hover()
  await page.mouse.down()
  await page.waitForTimeout(5)
  await page.mouse.up()
  await page.waitForTimeout(160)
  await expect(count).toHaveText('0')
  await expect(action).toHaveText('none')

  await enabled.hover()
  await page.mouse.down()
  await page.waitForTimeout(160)
  await expect(count).toHaveText('1')
  await expect(action).toHaveText('completed hold')
  await page.waitForTimeout(160)
  await expect(count).toHaveText('1')
  await page.mouse.up()

  await enabled.hover()
  await page.mouse.down()
  await page.waitForTimeout(160)
  await expect(count).toHaveText('2')
  await page.mouse.up()
  await expect(action).toHaveText('completed hold')

  await expect(disabled).toHaveAttribute('aria-disabled', 'true')
  await expect(disabled).not.toHaveAttribute('disabled')
  await disabled.hover()
  await page.mouse.down()
  await page.waitForTimeout(160)
  await expect(count).toHaveText('2')
  await expect(action).toHaveText('completed hold')
  await page.mouse.up()
  await expect(readout).toHaveText('Long-press count: 2; Last action: completed hold')
})
