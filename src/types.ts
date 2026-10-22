export type Harness = 'codex' | 'claude' | 'copilot' | 'omp';
export type Status = 'working' | 'waiting' | 'idle' | 'complete' | 'error' | 'stale';
export type Agent = {
  id: string;
  parentId: string | null;
  name: string;
  status: Status;
  activity: string;
  kind?: string;
  updatedAt: number;
};
export type Activity = { at: number; agentId: string; text: string; kind: string };
export type Session = {
  id: string;
  rawId: string;
  harness: Harness;
  client?: string | null;
  title: string;
  task?: string | null;
  cwd: string;
  repoKey: string;
  repoName: string;
  sourcePath: string;
  status: Status;
  activity: string;
  lastActivity: number;
  eventCount: number;
  agents: Agent[];
  files: Record<string, number>;
  timeline: Activity[];
};
export type AdapterHealth = {
  harness: Harness;
  root: string;
  available: boolean;
  journals: number;
  warning: string | null;
};
export type Snapshot = {
  sessions: Session[];
  adapters: AdapterHealth[];
  scannedAt: number;
  scanning: boolean;
};
export type Settings = { roots: Record<Harness, string>; historyHours: number };
export const HARNESSES: Record<
  Harness,
  { label: string; color: string; terrain: string; mark: string }
> = {
  codex: { label: 'Codex', color: '#a7c695', terrain: '#76916a', mark: 'C' },
  claude: { label: 'Claude Code', color: '#dfab79', terrain: '#9c8f61', mark: '✳' },
  copilot: { label: 'Copilot', color: '#a7b7d7', terrain: '#6c8a8a', mark: '∞' },
  omp: { label: 'Oh My Pi', color: '#c0a6d9', terrain: '#848270', mark: 'π' },
};
export const STATUS_LABEL: Record<Status, string> = {
  working: 'Working',
  waiting: 'Needs you',
  idle: 'Resting',
  complete: 'Closed',
  error: 'Error',
  stale: 'Last seen',
};
