import { useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ArrowUpRight,
  ChevronRight,
  Copy,
  ExternalLink,
  Flag,
  GitBranch,
  Hexagon,
  Layers,
  Maximize2,
  Monitor,
  Move,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sprout,
  Users,
  X,
  Check,
  Network,
  Pause,
  Play,
} from 'lucide-react';
import type { Harness, Session, Settings, Snapshot } from './types';
import { HARNESSES, STATUS_LABEL } from './types';
import { age, agentDepth, resumeCommand, sharedFiles } from './world';
import { demoSnapshot } from './demo';
import WorldMap from './WorldMap';
import Settlement from './Settlement';

const native = isTauri();
const empty: Snapshot = { sessions: [], adapters: [], scannedAt: 0, scanning: true };
const harnessKeys = Object.keys(HARNESSES) as Harness[];
function Logo() {
  return (
    <span className="brand-symbol">
      <Hexagon size={35} strokeWidth={1.2} />
      <span>Æ</span>
    </span>
  );
}
export default function App() {
  const [demo, setDemo] = useState(() => !native || localStorage.getItem('ae-demo') === 'true');
  const [snapshot, setSnapshot] = useState<Snapshot>(() => (native ? empty : demoSnapshot()));
  const [selected, setSelected] = useState<string | null>(() =>
    localStorage.getItem('ae-selected'),
  );
  const [filter, setFilter] = useState<Harness | null>(null);
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(() => localStorage.getItem('ae-paused') === 'true');
  const [compact, setCompact] = useState(new URLSearchParams(location.search).has('buddy'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  const [commandShell, setCommandShell] = useState<'posix' | 'powershell'>(
    navigator.userAgent.includes('Windows') ? 'powershell' : 'posix',
  );
  const tick = useRef(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = demo ? demoSnapshot(tick.current++) : await invoke<Snapshot>('get_snapshot');
        if (alive) {
          setSnapshot(next);
          setError('');
        }
      } catch (e) {
        if (alive) setError(`Session monitor unavailable: ${String(e)}`);
      } finally {
        if (alive) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [demo]);
  useEffect(() => {
    localStorage.setItem('ae-paused', String(paused));
  }, [paused]);
  useEffect(() => {
    localStorage.setItem('ae-demo', String(demo));
  }, [demo]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === 'ae-selected') setSelected(e.newValue);
      if (e.key === 'ae-paused') setPaused(e.newValue === 'true');
      if (e.key === 'ae-demo') {
        setSnapshot(empty);
        setDemo(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        setShowCommand(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const sessions = snapshot.sessions.filter(
    (s) =>
      (!filter || s.harness === filter) &&
      (!activeOnly || s.agents.some((a) => a.status === 'working' || a.status === 'waiting')) &&
      `${s.title} ${s.task ?? ''} ${s.repoName}`.toLowerCase().includes(query.toLowerCase()),
  );
  const current = sessions.find((s) => s.id === selected) ?? sessions[0];
  const workers = snapshot.sessions.reduce((n, s) => n + s.agents.length, 0);
  const working = snapshot.sessions.reduce(
    (n, s) => n + s.agents.filter((a) => a.status === 'working').length,
    0,
  );
  const waiting = snapshot.sessions.filter((s) =>
    s.agents.some((a) => a.status === 'waiting'),
  ).length;
  const events = snapshot.sessions
    .flatMap((s) => s.timeline.map((e, i) => ({ ...e, session: s, key: `${s.id}-${i}` })))
    .sort((a, b) => b.at - a.at)
    .slice(0, 4);
  const toggleView = async (value: boolean) => {
    if (native) {
      try {
        await invoke('set_view', { compact: value });
      } catch (e) {
        setError(String(e));
      }
    } else setCompact(value);
  };
  const choose = (id: string) => {
    setSelected(id);
    localStorage.setItem('ae-selected', id);
    setShowCommand(false);
  };
  const openSource = async (s: Session) => {
    if (demo) {
      setError(
        'This is a demonstration settlement. Live sessions can be revealed in Finder or Explorer.',
      );
      return;
    }
    try {
      await invoke('reveal_source', { id: s.id });
    } catch (e) {
      setError(String(e));
    }
  };
  if (compact)
    return (
      <div
        className={`companion ${paused ? 'paused' : ''}`}
        onDoubleClick={() => void toggleView(false)}
      >
        <div
          className="companion-tools"
          title={native ? 'Drag to move the companion' : 'Desktop companion preview'}
          onPointerDown={() => {
            if (native) {
              void getCurrentWindow()
                .startDragging()
                .catch((e) => setError(`Cannot move companion: ${String(e)}`));
            }
          }}
        >
          <button aria-label="Move companion" title="Drag this bar to move the companion">
            <Move size={14} />
            <span>DRAG</span>
          </button>
          <span title={current?.title}>
            {current?.title ?? (demo ? 'DEMO WORLD' : 'YOUR LITTLE EMPIRE')}
          </span>
          <button
            aria-label="Expand world"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void toggleView(false)}
          >
            <Maximize2 size={14} />
          </button>
        </div>
        {current ? (
          <>
            <div className="companion-bubble">
              {current.task ?? current.activity.split(' · ')[0]}
              <span>
                {current.activity.split(' · ')[0]} · {current.agents.length} settlers
              </span>
            </div>
            <svg viewBox="-140 -125 280 260" className="companion-world">
              <Settlement session={current} compact />
            </svg>
          </>
        ) : (
          <div className="companion-empty">
            <Sprout size={30} />
            <p>Waiting for an expedition</p>
            <span>Start a local coding agent</span>
          </div>
        )}
        <div className="companion-bottom">
          <span className="live-dot" />
          {working} working · {snapshot.sessions.length} settlements
          <button
            aria-label={paused ? 'Resume animation' : 'Pause animation'}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
        </div>
        {error && (
          <div className="companion-error" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <Logo />
          <div>
            AgentEmpires<span>YOUR AGENTS, ALIVE.</span>
          </div>
          <small>α 0.1</small>
        </a>
        <div className="top-actions">
          <span className="private-badge">
            <ShieldCheck size={14} /> Local by nature
          </span>
          <button className="button subtle" onClick={() => void toggleView(true)}>
            <Monitor size={15} /> Desktop companion
            <ArrowUpRight size={14} />
          </button>
          <button
            className="icon-button"
            title="Connections and settings"
            aria-label="Connections and settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">
              <span className="live-dot" />{' '}
              {demo
                ? 'A GLIMPSE OF YOUR NEXT EMPIRE'
                : working
                  ? 'THE WORLD IS AT WORK'
                  : 'A LITTLE WORLD, READY FOR WORK'}
            </div>
            <h1>
              Great things start
              <br className="mobile-break" /> with little settlers.
            </h1>
            <p>Every session a settlement. Every agent a story unfolding.</p>
          </div>
          <div className="world-stats">
            <div>
              <span>
                <Flag size={15} /> Settlements
              </span>
              <strong>{snapshot.sessions.length.toString().padStart(2, '0')}</strong>
            </div>
            <div>
              <span>
                <Users size={15} /> Settlers
              </span>
              <strong>{workers.toString().padStart(2, '0')}</strong>
            </div>
            <div>
              <span>
                <Sprout size={15} /> At work
              </span>
              <strong className="green-text">{working.toString().padStart(2, '0')}</strong>
            </div>
          </div>
        </div>
        {demo && (
          <div className="demo-banner">
            <span>
              <span className="demo-tag">DEMO</span> An illustrative world. These settlements are
              simulated.
            </span>
            {native ? (
              <button
                onClick={() => {
                  setDemo(false);
                  setSnapshot(empty);
                  setSelected(null);
                }}
              >
                Return to live sessions <ArrowUpRight size={14} />
              </button>
            ) : (
              <span className="preview-note">
                Run the desktop app to observe your local agents.
              </span>
            )}
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button aria-label="Dismiss message" onClick={() => setError('')}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="toolbar">
          <div className="harness-tabs">
            <button className={!filter ? 'active' : ''} onClick={() => setFilter(null)}>
              All kingdoms <span>{snapshot.sessions.length}</span>
            </button>
            {harnessKeys.map((key) => (
              <button
                key={key}
                className={filter === key ? 'active' : ''}
                onClick={() => setFilter(filter === key ? null : key)}
                style={{ '--harness-color': HARNESSES[key].color } as React.CSSProperties}
              >
                <i />
                {HARNESSES[key].label}
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <label className="search-box">
              <Search size={14} />
              <input
                placeholder="Find a settlement"
                aria-label="Find a settlement"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className={`active-filter ${activeOnly ? 'enabled' : ''}`}
              onClick={() => setActiveOnly((v) => !v)}
              aria-pressed={activeOnly}
            >
              Active only
            </button>
          </div>
        </div>
        <div className="world-layout">
          <WorldMap
            sessions={sessions}
            selected={current?.id ?? null}
            onSelect={choose}
            paused={paused}
            onPause={() => setPaused((p) => !p)}
          />
          <aside className="inspector">
            {current ? (
              <>
                <div className="inspector-top">
                  <span className="eyebrow">SETTLEMENT DETAILS</span>
                  <span className={`status status-${current.status}`}>
                    <i />
                    {STATUS_LABEL[current.status]}
                  </span>
                </div>
                <div className="settlement-heading">
                  <span
                    className="harness-crest"
                    style={{ color: HARNESSES[current.harness].color }}
                  >
                    {HARNESSES[current.harness].mark}
                  </span>
                  <div>
                    <h2>{current.title}</h2>
                    <span>
                      {HARNESSES[current.harness].label} <b>·</b> {current.repoName}
                    </span>
                  </div>
                </div>
                <p className="observed-time">
                  <Radio size={12} /> Last observed {age(current.lastActivity)}
                </p>
                <div className="activity-callout">
                  <span className="eyebrow">
                    {current.task ? 'CURRENT TASK' : 'AT THE SETTLEMENT'}
                  </span>
                  <p>{current.task ?? current.activity.split(' · ')[0]}</p>
                  {current.task && (
                    <span className="observed-action">{current.activity.split(' · ')[0]}</span>
                  )}
                  {current.activity.includes(' · ') && (
                    <code>{current.activity.split(' · ').slice(1).join(' · ')}</code>
                  )}
                </div>
                <div className="section-label">
                  <span>THE SETTLERS</span>
                  <span>{current.agents.length}</span>
                </div>
                <div className="agent-tree">
                  {current.agents.map((a) => (
                    <div
                      className="agent-row"
                      key={a.id}
                      style={{ marginLeft: `${agentDepth(a.id, current.agents) * 12}px` }}
                    >
                      <span className={`agent-avatar ${a.status}`}>
                        {a.parentId ? <Users size={14} /> : <Flag size={14} />}
                      </span>
                      <div>
                        <strong>{a.name}</strong>
                        <span>{a.activity.split(' · ')[0]}</span>
                      </div>
                      <i className={`state-dot ${a.status}`} title={STATUS_LABEL[a.status]} />
                    </div>
                  ))}
                </div>
                <div className="section-label">
                  <span>NEIGHBORING WORK</span>
                  <GitBranch size={13} />
                </div>
                <div className="neighbors">
                  {snapshot.sessions
                    .filter(
                      (s) =>
                        s.id !== current.id &&
                        (s.repoKey === current.repoKey || sharedFiles(s, current).length),
                    )
                    .slice(0, 3)
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setFilter(null);
                          setQuery('');
                          setActiveOnly(false);
                          choose(s.id);
                        }}
                      >
                        <i style={{ background: HARNESSES[s.harness].color }} />
                        <span>
                          {s.title}
                          <small>
                            {sharedFiles(s, current).length
                              ? `${sharedFiles(s, current).length} shared files`
                              : 'Same repository'}
                          </small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  {!snapshot.sessions.some(
                    (s) =>
                      s.id !== current.id &&
                      (s.repoKey === current.repoKey || sharedFiles(s, current).length),
                  ) && <p className="muted">An independent expedition, for now.</p>}
                </div>
                <div className="inspector-footer">
                  <button className="button primary" onClick={() => void openSource(current)}>
                    <ExternalLink size={14} /> Reveal source journal
                  </button>
                  <button className="text-button" onClick={() => setShowCommand((v) => !v)}>
                    Resume in your terminal <ArrowUpRight size={13} />
                  </button>
                  {showCommand && (
                    <div className="command-box">
                      <p>Use after the original session stops. This opens a resumed CLI session.</p>
                      <select
                        aria-label="Terminal shell"
                        value={commandShell}
                        onChange={(e) => setCommandShell(e.target.value as 'posix' | 'powershell')}
                      >
                        <option value="posix">macOS / POSIX shell</option>
                        <option value="powershell">Windows PowerShell</option>
                      </select>
                      <code>{resumeCommand(current, commandShell === 'powershell')}</code>
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              resumeCommand(current, commandShell === 'powershell'),
                            );
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1800);
                          } catch {
                            setError('Clipboard unavailable. Select and copy the command above.');
                          }
                        }}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}{' '}
                        {copied ? 'Copied' : 'Copy command'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="inspector-empty">
                <Flag size={28} />
                <h2>A new chapter awaits</h2>
                <p>
                  {snapshot.scanning
                    ? 'Surveying local session journals…'
                    : 'No settlements match this view.'}
                </p>
                <button className="button primary" onClick={() => setSettingsOpen(true)}>
                  Check connections
                </button>
                {!demo && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setDemo(true);
                      setFilter(null);
                      setQuery('');
                    }}
                  >
                    Explore a demo world <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
        <section className="chronicle">
          <div className="chronicle-title">
            <span className="eyebrow">THE CHRONICLE</span>
            <h2>Word from the frontier</h2>
            <span>{demo ? 'Illustrative events' : 'Observed journal activity'}</span>
          </div>
          <div className="chronicle-events">
            {events.length ? (
              events.map((e) => (
                <button
                  key={e.key}
                  onClick={() => {
                    setFilter(null);
                    setQuery('');
                    setActiveOnly(false);
                    choose(e.session.id);
                  }}
                >
                  <span
                    className="event-symbol"
                    style={{ color: HARNESSES[e.session.harness].color }}
                  >
                    {e.kind === 'building' ? (
                      <Layers size={17} />
                    ) : e.kind === 'gathering' ? (
                      <Sprout size={17} />
                    ) : (
                      <Flag size={17} />
                    )}
                  </span>
                  <div>
                    <strong>{e.text.split(' · ')[0]}</strong>
                    <span>
                      {e.session.repoName} <b>·</b> {age(e.at)}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <p className="muted">The chronicle will fill as your agents work.</p>
            )}
          </div>
        </section>
        <footer>
          <span>
            <span className="live-dot" />
            {demo
              ? 'Demo world'
              : snapshot.scanning
                ? 'Reading journals…'
                : 'Local journal monitor'}{' '}
            <b>·</b> {demo ? 'No live sessions connected' : 'Refreshes every 2 seconds'}
          </span>
          <button onClick={() => setSettingsOpen(true)}>
            <Network size={13} />
            {native
              ? `${snapshot.adapters.filter((a) => a.available).length}/4 journal locations found`
              : 'Connect your kingdoms'}
            <ChevronRight size={13} />
          </button>
          <span className="footer-privacy">Your work stays on your device.</span>
        </footer>
      </main>
      {waiting > 0 && !demo && (
        <button
          className="attention-toast"
          onClick={() => {
            const s = snapshot.sessions.find((s) => s.agents.some((a) => a.status === 'waiting'));
            if (s) {
              setFilter(null);
              setQuery('');
              choose(s.id);
            }
          }}
        >
          <Flag size={15} />
          {waiting} settlement{waiting > 1 ? 's' : ''} awaiting your guidance
        </button>
      )}
      {settingsOpen && (
        <Connections
          snapshot={snapshot}
          onClose={() => setSettingsOpen(false)}
          onDemo={() => {
            setDemo(true);
            setFilter(null);
            setQuery('');
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Connections({
  snapshot,
  onClose,
  onDemo,
}: {
  snapshot: Snapshot;
  onClose: () => void;
  onDemo: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const focus = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    if (native)
      invoke<Settings>('get_settings')
        .then(setSettings)
        .catch((e) => setMessage(String(e)));
    return () => focus?.focus();
  }, []);
  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await invoke('save_settings', { settings });
      setMessage('Saved. The monitor will refresh on its next scan.');
    } catch (e) {
      setMessage(String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="connections-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connections-title"
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            const nodes = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                'button, input, select, [tabindex="0"]',
              ),
            ].filter((n) => !n.hasAttribute('disabled'));
            const first = nodes[0],
              last = nodes.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="modal-title">
          <div>
            <span className="eyebrow">THE FOUR KINGDOMS</span>
            <h2 id="connections-title">Connect your agents.</h2>
          </div>
          <button
            ref={closeRef}
            aria-label="Close connections"
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          AgentEmpires reads local CLI journals. Start your agents as usual; settlements appear when
          their activity is written to disk.
        </p>
        {harnessKeys.map((h) => {
          const health = snapshot.adapters.find((a) => a.harness === h);
          return (
            <div className="connection" key={h}>
              <div>
                <span className="connection-mark" style={{ color: HARNESSES[h].color }}>
                  {HARNESSES[h].mark}
                </span>
                <strong>{HARNESSES[h].label}</strong>
                <span className={`connection-status ${health?.available ? 'found' : ''}`}>
                  {native
                    ? health?.available
                      ? `${health.journals} recent journals`
                      : 'Location not found'
                    : 'Desktop app required'}
                </span>
              </div>
              {settings ? (
                <input
                  aria-label={`${HARNESSES[h].label} journal directory`}
                  value={settings.roots[h]}
                  onChange={(e) =>
                    setSettings({ ...settings, roots: { ...settings.roots, [h]: e.target.value } })
                  }
                />
              ) : (
                <code>
                  {h === 'codex'
                    ? '~/.codex/sessions'
                    : h === 'claude'
                      ? '~/.claude/projects'
                      : h === 'copilot'
                        ? '~/.copilot/session-state'
                        : '~/.omp/agent/sessions'}
                </code>
              )}
              {health?.warning && <small className="connection-warning">{health.warning}</small>}
            </div>
          );
        })}
        {settings && (
          <label className="history-setting">
            Look back{' '}
            <select
              value={settings.historyHours}
              onChange={(e) => setSettings({ ...settings, historyHours: Number(e.target.value) })}
            >
              <option value="1">1 hour</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </select>
          </label>
        )}
        <div className="connection-note">
          <ShieldCheck size={17} />
          <p>
            Read only. No account, model API, or telemetry. Journal activity is an observation—not
            proof that a process is still running. After two quiet minutes, working agents become
            “Last seen.”
          </p>
        </div>
        <p className="modal-footnote">
          CLI sessions only. Ephemeral sessions, remote sessions, and journals stored in WSL or
          custom profiles need an accessible journal path. “Reveal source” opens the journal
          location; terminal tabs cannot be reliably focused across harnesses.
        </p>
        {message && (
          <p role="status" className="settings-message">
            {message}
          </p>
        )}
        <div className="modal-actions">
          <button className="text-button" onClick={onDemo}>
            Explore demo world <ArrowUpRight size={14} />
          </button>
          {native && (
            <button
              className="button primary"
              disabled={saving || !settings}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save connections'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
