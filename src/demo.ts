import type { Harness, Session, Status, Snapshot } from './types';
const definitions: [string, Harness, string, Status, string, string, number][] = [
  ['Cartographer', 'codex', 'atlas', 'working', 'Editing routes.ts · apply_patch', 'building', 4],
  ['The watchtower', 'claude', 'atlas', 'working', 'Running tests · Bash', 'testing', 3],
  [
    'A new trading post',
    'omp',
    'marketplace',
    'working',
    'Reading README.md · read',
    'gathering',
    2,
  ],
  ['Northern passage', 'copilot', 'atlas', 'waiting', 'Awaiting your guidance', 'waiting', 3],
  [
    'The great library',
    'claude',
    'docs',
    'working',
    'Reading or searching files · Grep',
    'gathering',
    3,
  ],
  [
    'The quiet workshop',
    'codex',
    'marketplace',
    'idle',
    'Turn finished · resting by the fire',
    'idle',
    1,
  ],
];
export function demoSnapshot(tick = 0): Snapshot {
  const now = Date.now();
  const sessions: Session[] = definitions.map(
    ([title, harness, repo, status, activity, kind, count], i) => {
      const at = now - 3000 - i * 2400;
      const agents = Array.from({ length: count }, (_, j) => ({
        id: j === 0 ? 'root' : `worker-${j}`,
        parentId: j === 0 ? null : j === 3 ? 'worker-1' : 'root',
        name:
          j === 0
            ? 'Lead agent'
            : j === 2 && i === 4
              ? 'Researcher'
              : ['', 'Builder', 'Scout', 'Engineer'][j],
        status:
          j === 0
            ? status
            : j === count - 1 && i === 0
              ? ('complete' as Status)
              : ('working' as Status),
        activity:
          j === 0
            ? activity
            : j === 2 && i === 4
              ? 'Using a tool · browser.open'
              : j % 2
                ? 'Editing project files · edit'
                : 'Reading project files · read',
        updatedAt: at,
      }));
      return {
        id: `demo-${i}`,
        rawId: `sample-${i}`,
        harness,
        title,
        task: [
          'Map the Atlas routes and fix the broken navigation',
          'Inspect the Atlas defenses and run the test suite',
          'Research inventory options for the trading post',
          'Plan the northern passage between Atlas regions',
          'Find and organize the project documentation',
          'Review the marketplace build before the next turn',
        ][i],
        cwd: `/demo/${repo}`,
        repoKey: repo,
        repoName: repo,
        sourcePath: `/demo/${harness}/sample-${i}.jsonl`,
        status,
        activity,
        lastActivity: at,
        eventCount: 14 + i * 21 + tick,
        agents,
        files:
          i < 2
            ? { '/demo/atlas/src/routes.ts': at, '/demo/atlas/src/map.ts': at }
            : { [`/demo/${repo}/README.md`]: at },
        timeline: [
          { at: at - 60000, agentId: 'root', text: 'A new expedition begins', kind: 'thinking' },
          {
            at: at - 32000,
            agentId: agents.at(-1)!.id,
            text: agents.at(-1)!.activity,
            kind: i === 4 ? 'tool' : 'gathering',
          },
          { at, agentId: 'root', text: activity, kind },
        ],
      };
    },
  );
  return { sessions, adapters: [], scannedAt: now, scanning: false };
}
