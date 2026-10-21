import { test, expect } from '@playwright/test';
test('world, selection, filters, companion and connection settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByText('An illustrative world. These settlements are simulated.'),
  ).toBeVisible();
  await expect(page.locator('[data-session]')).toHaveCount(6);
  await page.locator('[data-session="demo-3"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.settlement-heading h2')).toHaveText('Northern passage');
  await expect(page.locator('.inspector .status')).toContainText('Needs you');
  await page.getByRole('button', { name: 'Claude Code', exact: true }).click();
  await expect(page.locator('[data-session]')).toHaveCount(2);
  await page.getByRole('button', { name: /All kingdoms/ }).click();
  await page.getByRole('textbox', { name: 'Find a settlement' }).fill('library');
  await expect(page.locator('[data-session]')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Find a settlement' }).fill('');
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect(page.locator('.map-panel')).toHaveClass(/paused/);
  await page.getByRole('button', { name: 'Desktop companion' }).click();
  await expect(page.locator('.companion')).toBeVisible();
  await page.getByRole('button', { name: 'Expand world' }).click();
  await expect(page.locator('.world-layout')).toBeVisible();
  await page.getByRole('button', { name: 'Connections and settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('~/.omp/agent/sessions')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset map view' }).click();
  await page.screenshot({ path: 'test-results/world.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('narrow viewport stays usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: 'Connections and settings' })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});
