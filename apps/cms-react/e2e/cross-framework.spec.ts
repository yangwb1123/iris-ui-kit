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
  | 'articles'
  | 'categories'
  | 'media'
  | 'roles'
  | 'overview'
  | 'reports'
  | 'calendar'
  | 'audit-log'

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

  await openSettings(page)
  const siteName = page.getByRole('textbox', { name: 'Site name' })
  await siteName.fill('Iris Cross-framework CMS')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toHaveText('Settings saved.')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await openSettings(page)
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
