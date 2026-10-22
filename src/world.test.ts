import { describe, expect, it } from 'vitest';
import {
  arrange,
  distance,
  affinity,
  sharedFiles,
  resumeCommand,
  agentDepth,
  settlersOnMap,
  busiestSession,
} from './world';
import { demoSnapshot } from './demo';
describe('world placement', () => {
  it('has no overlaps and keeps established settlements stable', () => {
    const sessions = demoSnapshot().sessions;
    const first = arrange(sessions.slice(0, 4));
    const next = arrange(sessions, first);
    expect(new Set([...next.values()].map((p) => `${p.q}:${p.r}`)).size).toBe(6);
    for (const [id, cell] of first) expect(next.get(id)).toEqual(cell);
  });
  it('places related sessions together and recognizes shared files', () => {
    const [a, b, c] = demoSnapshot().sessions;
    const layout = arrange([a, c, b]);
    expect(affinity(a, b)).toBeGreaterThan(affinity(a, c));
    expect(sharedFiles(a, b)).toHaveLength(2);
    expect(distance(layout.get(a.id)!, layout.get(b.id)!)).toBe(1);
  });
  it('preserves all sessions when many share a repo', () => {
    const base = demoSnapshot().sessions[0];
    const sessions = Array.from({ length: 100 }, (_, i) => ({ ...base, id: `s-${i}` }));
    const layout = arrange(sessions);
    expect(layout.size).toBe(100);
    expect(new Set([...layout.values()].map((p) => `${p.q}:${p.r}`)).size).toBe(100);
  });
});
describe('safe session navigation', () => {
  it('quotes shell metacharacters without executing them', () => {
    const s = { ...demoSnapshot().sessions[0], cwd: "/work/a'b; $(echo nope)", rawId: "id'1" };
    expect(resumeCommand(s)).toContain("cd -- '/work/a'\\''b; $(echo nope)'");
    expect(resumeCommand(s, true)).toContain(
      "Set-Location -LiteralPath '/work/a''b; $(echo nope)'",
    );
  });
  it('uses a journal path for OMP and computes nested worker depth', () => {
    const s = demoSnapshot().sessions[2];
    expect(resumeCommand(s)).toContain('omp --resume');
    const a = demoSnapshot().sessions[0];
    expect(agentDepth('worker-3', a.agents)).toBe(2);
  });
});
describe('settler presence', () => {
  it('lets finished workers leave while keeping their journal history', () => {
    const session = demoSnapshot().sessions[0];
    const finished = session.agents.at(-1)!;
    const now = finished.updatedAt;
    expect(settlersOnMap(session, now).some((agent) => agent.id === finished.id)).toBe(true);
    expect(settlersOnMap(session, now + 12_000).some((agent) => agent.id === finished.id)).toBe(
      false,
    );
    expect(session.agents).toContain(finished);
  });
});
describe('companion selection', () => {
  it('follows the most active observed settlement and ignores finished workers', () => {
    const now = Date.now();
    const [recent, busy] = demoSnapshot().sessions;
    for (const agent of recent.agents.slice(1)) {
      agent.status = 'complete';
      agent.updatedAt = now - 20_000;
    }
    expect(busiestSession([recent, busy], now)?.id).toBe(busy.id);
    for (const agent of busy.agents.slice(1)) {
      agent.status = 'complete';
      agent.updatedAt = now - 20_000;
    }
    expect(busiestSession([busy, recent], now)?.id).toBe(recent.id);
    expect(busiestSession([])).toBeUndefined();
  });
});
