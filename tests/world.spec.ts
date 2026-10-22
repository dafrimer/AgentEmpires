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
  await expect(worker.locator('.worker-speech')).toContainText('Editing routes.ts');
  await page.mouse.move(5, 5);
  await page.locator('[data-session="demo-3"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.settlement-heading h2')).toHaveText('Northern passage');
  await expect(page.locator('.activity-callout')).toContainText(
    'Plan the northern passage between Atlas regions',
  );
  await expect(page.locator('.inspector .status')).toContainText('Needs you');
  await page.getByRole('button', { name: 'Claude Code', exact: true }).click();
  await expect(page.locator('[data-session]')).toHaveCount(2);
  await page.getByRole('button', { name: /All kingdoms/ }).click();
  await page.getByRole('textbox', { name: 'Find a settlement' }).fill('library');
  await expect(page.locator('[data-session]')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Find a settlement' }).fill('');
  await page.getByRole('textbox', { name: 'Find a settlement' }).fill('inventory options');
  await expect(page.locator('[data-session]')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Find a settlement' }).fill('');
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await expect(page.locator('.map-panel')).toHaveClass(/paused/);
  await page.getByRole('button', { name: 'Desktop companion' }).click();
  await expect(page.locator('.companion')).toBeVisible();
  await expect(page.locator('.companion-tools > span')).toContainText('Northern passage');
  await expect(page.locator('.companion-bubble')).toContainText('Plan the northern passage');
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
      metadata: { currentWindow: { label: 'buddy' } },
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
                activity: 'Working at the workshop · exec_command',
                lastActivity: Date.now(),
                eventCount: 5,
                agents: [
                  {
                    id: 'root',
                    parentId: null,
                    name: 'Lead agent',
                    status: 'working',
                    activity: 'Working at the workshop · exec_command',
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
  await expect(page.locator('[data-session="codex:fixture"] .worker .pose-secondary')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-session="codex:fixture"] .resource-route')).toHaveCount(0);
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
  await page.goto('/?buddy=1');
  await expect(page.locator('.companion-tools')).toBeVisible();
  await page.getByRole('button', { name: 'Move companion' }).click();
  const dragCalls = await page.evaluate(
    () => (window as unknown as { ipcCalls: { cmd: string; args: unknown }[] }).ipcCalls,
  );
  expect(dragCalls).toContainEqual({
    cmd: 'plugin:window|start_dragging',
    args: { label: 'buddy' },
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

test('working villagers make a round trip and carry resources home', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const executing = page.locator('[data-session="demo-1"] .worker').first();
  await expect(executing.locator('.pose-secondary')).toHaveCount(1);
  await expect(executing).not.toHaveClass(/resource-route/);
  const route = page.locator('[data-session="demo-2"] .resource-route').first();
  await expect(route).toBeVisible();
  const samples = await route.evaluate((worker) => {
    const animations = worker
      .getAnimations({ subtree: true })
      .filter((animation) =>
        ['resource-route', 'route-outbound', 'route-harvest', 'route-return'].includes(
          (animation as CSSAnimation).animationName,
        ),
      );
    const sample = (progress: number) => {
      for (const animation of animations) {
        animation.pause();
        const timing = animation.effect!.getTiming();
        animation.currentTime = progress * Number(timing.duration) - Number(timing.delay);
      }
      return {
        x: new DOMMatrixReadOnly(getComputedStyle(worker).transform).m41,
        outward: getComputedStyle(worker.querySelector('.route-outbound')!).opacity,
        harvest: getComputedStyle(worker.querySelector('.route-harvest')!).opacity,
        carrying: getComputedStyle(worker.querySelector('.route-return')!).opacity,
      };
    };
    return [sample(0.05), sample(0.45), sample(0.7), sample(0.95)];
  });
  expect(Math.abs(samples[0].x)).toBeLessThan(2);
  expect(samples[0].outward).toBe('1');
  expect(samples[1].x).toBeGreaterThan(65);
  expect(samples[1].harvest).toBe('1');
  expect(samples[2].x).toBeGreaterThan(10);
  expect(samples[2].x).toBeLessThan(samples[1].x);
  expect(samples[2].carrying).toBe('1');
  expect(Math.abs(samples[3].x)).toBeLessThan(2);
  await expect(route.locator('.route-return .pose-secondary')).toHaveCount(1);
  await expect(route.locator('.route-return .carried-supplies')).toHaveCount(1);
});

test('idle villagers walk short rounds instead of standing still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const villager = page.locator('[data-session="demo-5"] .idle-route').first();
  await expect(villager).toBeVisible();
  await expect(villager.locator('.route-outbound .pose-secondary')).toHaveCount(1);
  await expect(villager.locator('.route-return .pose-secondary')).toHaveCount(1);
  const samples = await villager.evaluate((element) => {
    const animation = element
      .getAnimations()
      .find((item) => (item as CSSAnimation).animationName === 'idle-route')!;
    animation.pause();
    const timing = animation.effect!.getTiming();
    return [0.05, 0.45, 0.95].map((progress) => {
      animation.currentTime = progress * Number(timing.duration) - Number(timing.delay);
      return new DOMMatrixReadOnly(getComputedStyle(element).transform).m41;
    });
  });
  expect(Math.abs(samples[0])).toBeLessThan(2);
  expect(samples[1]).toBeGreaterThan(15);
  expect(Math.abs(samples[2])).toBeLessThan(2);
});

test('other tool calls use a separate animated workbench', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const worker = page.locator('[data-session="demo-4"] .tool-action');
  await expect(worker).toHaveCount(1);
  await expect(worker.locator('.tool-frame')).toHaveCount(4);
  await expect(worker).not.toHaveClass(/resource-route/);
  const visibleFrames = await worker.evaluate((element) => {
    const frames = [...element.querySelectorAll<SVGElement>('.tool-frame')];
    const animations = frames.map((frame) => frame.getAnimations()[0]);
    return [400, 1200, 2000, 2800].map((time) => {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = time;
      }
      return frames.map((frame) => getComputedStyle(frame).opacity);
    });
  });
  expect(visibleFrames).toEqual([
    ['1', '0', '0', '0'],
    ['0', '1', '0', '0'],
    ['0', '0', '1', '0'],
    ['0', '0', '0', '1'],
  ]);
});
