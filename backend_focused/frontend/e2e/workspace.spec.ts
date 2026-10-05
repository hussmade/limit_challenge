import { expect, test, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page, username = 'operator') {
  await page.goto('/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD ?? 'Local-demo-2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}

test('dashboard, vehicle filters, details and browser history', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Keep things moving.' })).toBeVisible();
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click();
  await page.getByLabel('Search vehicles').fill('Ford');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/search=Ford/);
  await expect(page.getByRole('table', { name: 'Vehicles' })).toContainText('Ford');
  await page.reload();
  await expect(page.getByLabel('Search vehicles')).toHaveValue('Ford');
  await page.getByRole('table').getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'Maintenance history' })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Search vehicles')).toHaveValue('Ford');
});
test('office create, edit and delete', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Offices', exact: true }).click();
  const name = `Test depot ${Date.now()}`;
  await page.getByRole('button', { name: 'Add office' }).click();
  await page.getByLabel('Office name').fill(name);
  await page.getByLabel('City').fill('Test City');
  await page.getByRole('button', { name: 'Create record' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Edit office/ }).click();
  await page.getByLabel('City').fill('Updated City');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(row).toContainText('Updated City');
  await row.getByRole('button', { name: /Delete office/ }).click();
  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(row).toBeHidden();
});
test('vehicle creation, service entry and protected deletion', async ({ page }) => {
  await login(page);
  await page.goto('/vehicles');
  await page.getByRole('button', { name: 'Add vehicle' }).click();
  const suffix = String(Date.now()).slice(-6);
  const vin = `1FTBR1C80PK${suffix}`;
  await page.getByLabel('VIN', { exact: false }).fill(vin);
  await page.getByLabel('License plate').fill(`TEST-${suffix}`);
  await page.getByLabel('Make').fill('TestMake');
  await page.getByRole('textbox', { name: /^Model/ }).fill('TestModel');
  await page.getByLabel('Model year').fill('2024');
  await page.getByRole('combobox', { name: /Office/ }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Create record' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByLabel('Search vehicles').fill(vin);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('table').getByRole('link', { name: 'TestMake TestModel' }).click();
  await page.getByRole('link', { name: 'Log service' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox', { name: /Mechanic/ }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('combobox', { name: /Service type/ }).click();
  await page.getByRole('option', { name: 'inspection', exact: true }).click();
  await page.getByLabel('Cost (USD)').fill('125.50');
  await page.getByLabel('Service notes').fill('Browser test service');
  await page.getByRole('button', { name: 'Create record' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('table')).toContainText('$125.50');
  const recordRow = page.getByRole('row').filter({ hasText: 'Browser test service' });
  await recordRow.getByRole('button', { name: /Edit maintenance/ }).click();
  await page.getByLabel('Cost (USD)').fill('130.50');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(recordRow).toContainText('$130.50');
  await page
    .getByRole('table')
    .getByRole('link', { name: /TestMake/ })
    .click();
  await page.getByRole('button', { name: 'Move to another office' }).click();
  await page.getByRole('combobox', { name: /New office/ }).fill('Pacific');
  await page.getByRole('option', { name: /Pacific/ }).click();
  await page.getByRole('button', { name: 'Move vehicle', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('Pacific operations', { exact: true })).toBeVisible();
  // Remove only the records created by this test, in dependency order.
  await page.goto(`/vehicles?search=${vin}`);
  await page
    .getByRole('table')
    .getByRole('button', { name: /Delete vehicle/ })
    .click();
  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.locator('.MuiAlert-root')).toContainText('still in use');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('table').getByRole('link').first().click();
  await page.getByRole('link', { name: 'Manage service records' }).click();
  await page
    .getByRole('table')
    .getByRole('button', { name: /Delete maintenance/ })
    .click();
  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto(`/vehicles?search=${vin}`);
  await page
    .getByRole('table')
    .getByRole('button', { name: /Delete vehicle/ })
    .click();
  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No matching records' })).toBeVisible();
});
test('viewer restrictions, empty state, error recovery and mobile layout', async ({ page }) => {
  await login(page, 'viewer');
  await page.goto('/vehicles?search=does-not-exist');
  await expect(page.getByRole('heading', { name: 'No matching records' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add vehicle' })).toHaveCount(0);
  await page.route('**/api/vehicles/?*', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{"detail":"Test outage"}',
    }),
  );
  await page.goto('/vehicles?search=Ford');
  await expect(page.locator('.MuiAlert-root')).toContainText('Test outage');
  await page.unroute('**/api/vehicles/?*');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-cards')).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
});

test('desktop accessibility, session renewal and sign out', async ({ page, context }) => {
  await login(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await skip.focus();
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(cookies.filter((c) => !c.name.endsWith('_access')));
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
