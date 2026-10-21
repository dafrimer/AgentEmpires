import type { Session } from './types';
export type Cell = { q: number; r: number };
const directions = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];
const key = (p: Cell) => `${p.q},${p.r}`;
export const distance = (a: Cell, b: Cell) =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const point = ({ q, r }: Cell) => ({ x: 228 * (q + r / 2), y: 136 * r });
export function sharedFiles(a: Session, b: Session) {
  return Object.keys(a.files).filter((p) => p in b.files);
}
export function affinity(a: Session, b: Session) {
  return (
    (a.repoKey === b.repoKey && a.repoKey !== 'unknown' ? 5 : 0) +
    Math.min(12, sharedFiles(a, b).length * 4)
  );
}
export function arrange(sessions: Session[], previous: Map<string, Cell> = new Map()) {
  const result = new Map<string, Cell>();
  const used = new Set<string>();
  for (const s of sessions) {
    const p = previous.get(s.id);
    if (p && !used.has(key(p))) {
      result.set(s.id, p);
      used.add(key(p));
    }
  }
  const ordered = [...sessions].sort(
    (a, b) => a.repoKey.localeCompare(b.repoKey) || a.id.localeCompare(b.id),
  );
  for (const s of ordered) {
    if (result.has(s.id)) continue;
    const candidates = new Map<string, Cell>();
    if (!result.size) candidates.set('0,0', { q: 0, r: 0 });
    for (const p of result.values())
      for (const d of directions) {
        const c = { q: p.q + d.q, r: p.r + d.r };
        if (!used.has(key(c))) candidates.set(key(c), c);
      }
    const cost = (c: Cell) => {
      let score = distance(c, { q: 0, r: 0 }) * 0.2;
      for (const other of sessions) {
        const p = result.get(other.id);
        if (p) score += affinity(s, other) * distance(c, p);
      }
      return score;
    };
    const best = [...candidates.values()].sort(
      (a, b) => cost(a) - cost(b) || a.r - b.r || a.q - b.q,
    )[0];
    result.set(s.id, best);
    used.add(key(best));
  }
  return result;
}
export function age(ms: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - ms) / 1000));
  return seconds < 10
    ? 'just now'
    : seconds < 60
      ? `${seconds}s ago`
      : seconds < 3600
        ? `${Math.floor(seconds / 60)}m ago`
        : `${Math.floor(seconds / 3600)}h ago`;
}
export function resumeCommand(s: Session, windows = false) {
  const quote = (v: string) =>
    windows ? `'${v.replaceAll("'", "''")}'` : `'${v.replaceAll("'", `'\\''`)}'`;
  const command =
    s.harness === 'codex'
      ? `codex resume ${quote(s.rawId)}`
      : s.harness === 'claude'
        ? `claude --resume ${quote(s.rawId)}`
        : s.harness === 'copilot'
          ? `copilot --resume=${quote(s.rawId)}`
          : `omp --resume ${quote(s.sourcePath)}`;
  return windows
    ? `Set-Location -LiteralPath ${quote(s.cwd)}; ${command}`
    : `cd -- ${quote(s.cwd)} && ${command}`;
}
export function agentDepth(id: string, agents: Session['agents']) {
  let depth = 0;
  let current = agents.find((a) => a.id === id);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    depth++;
    current = agents.find((a) => a.id === current!.parentId);
  }
  return Math.min(depth, 8);
}
