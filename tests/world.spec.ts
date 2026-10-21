import { test, expect } from '@playwright/test';
test('world, selection, filters, companion and connection settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByText('An illustrative world. These settlements are simulated.'),
  ).toBeVisible();
  await expect(page.locator('[data-session]')).toHaveCount(6);
  const worker = page.locator('[data-session="demo-0"] .worker').first();
  await worker.locator('.worker-hit').hover();
  await expect(worker.locator('.worker-speech')).toBeVisible();
  await expect(worker.locator('.worker-speech')).toContainText('Building the settlement');
  await page.mouse.move(5, 5);
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
  await page.locator('[data-session="demo-0"]').focus();
  await page.keyboard.press('Enter');
  await page.screenshot({ path: 'test-results/world.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('desktop IPC uses live data, saves roots, and reveals only a selected session ID', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const host = window as unknown as {
      isTauri: boolean;
      __TAURI_INTERNALS__: unknown;
      ipcCalls: { cmd: string; args: unknown }[];
    };
    host.isTauri = true;
    host.ipcCalls = [];
    host.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: Record<string, unknown>) => {
        host.ipcCalls.push({ cmd, args });
        if (cmd === 'get_snapshot')
          return {
            sessions: [
              {
                id: 'codex:fixture',
                rawId: 'fixture',
                harness: 'codex',
                title: 'Native fixture',
                cwd: '/test/repo',
                repoKey: '/test/repo/.git',
                repoName: 'repo',
                sourcePath: '/test/sessions/fixture.jsonl',
                status: 'working',
                activity: 'Building the settlement · apply_patch',
                lastActivity: Date.now(),
                eventCount: 5,
                agents: [
                  {
                    id: 'root',
                    parentId: null,
                    name: 'Lead agent',
                    status: 'working',
                    activity: 'Building the settlement',
                    updatedAt: Date.now(),
                  },
                ],
                files: {},
                timeline: [],
              },
            ],
            adapters: [],
            scannedAt: Date.now(),
            scanning: false,
          };
        if (cmd === 'get_settings')
          return {
            historyHours: 24,
            roots: {
              codex: '/test/codex',
              claude: '/test/claude',
              copilot: '/test/copilot',
              omp: '/test/omp',
            },
          };
        return null;
      },
    };
  });
  await page.goto('/');
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.locator('.settlement-heading h2')).toHaveText('Native fixture');
  await page.getByRole('button', { name: 'Reveal source journal' }).click();
  await page.getByRole('button', { name: 'Connections and settings' }).click();
  await page.getByRole('textbox', { name: 'Oh My Pi journal directory' }).fill('/custom/omp');
  await page.getByRole('button', { name: 'Save connections' }).click();
  await expect(page.getByRole('status')).toContainText('Saved.');
  const calls = await page.evaluate(
    () => (window as unknown as { ipcCalls: { cmd: string; args: unknown }[] }).ipcCalls,
  );
  expect(calls).toContainEqual({ cmd: 'reveal_source', args: { id: 'codex:fixture' } });
  expect(calls.find((c) => c.cmd === 'save_settings')).toMatchObject({
    args: { settings: { roots: { omp: '/custom/omp' } } },
  });
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
