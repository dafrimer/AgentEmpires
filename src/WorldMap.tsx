import { useMemo, useRef, useState } from 'react';
import { Focus, Minus, Plus, Pause, Play, Map as MapIcon } from 'lucide-react';
import type { Session } from './types';
import { arrange, point, affinity, sharedFiles } from './world';
import type { Cell } from './world';
import Settlement from './Settlement';

export default function WorldMap({
  sessions,
  selected,
  onSelect,
  paused,
  onPause,
}: {
  sessions: Session[];
  selected: string | null;
  onSelect: (id: string) => void;
  paused: boolean;
  onPause: () => void;
}) {
  const previous = useRef(new Map<string, Cell>());
  const cells = useMemo(() => {
    const next = arrange(sessions, previous.current);
    previous.current = next;
    return next;
  }, [sessions]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; distance: number } | null>(
    null,
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const positions = [...cells.values()].map(point);
  const minX = Math.min(...positions.map((p) => p.x), 0) - 155,
    maxX = Math.max(...positions.map((p) => p.x), 0) + 155;
  const minY = Math.min(...positions.map((p) => p.y), 0) - 170,
    maxY = Math.max(...positions.map((p) => p.y), 0) + 145;
  const width = Math.max(720, maxX - minX),
    height = Math.max(550, maxY - minY),
    cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  const links = sessions.flatMap((a, i) =>
    sessions
      .slice(i + 1)
      .filter((b) => affinity(a, b) > 0)
      .map((b) => ({ a, b, shared: sharedFiles(a, b).length })),
  );
  return (
    <section className={`map-panel ${paused ? 'paused' : ''}`} aria-label="Agent world map">
      <div className="map-heading">
        <span className="eyebrow">
          <span className="small-diamond" /> THE FRONTIER
        </span>
        <span>
          {sessions.length} settlements · {links.length} connections
        </span>
      </div>
      <div className="compass" aria-hidden="true">
        <span>N</span>
        <svg viewBox="0 0 50 65">
          <path d="M25 12 35 48 25 41 15 48Z" fill="#a6b18e" />
          <path d="M25 12v29l10 7Z" fill="#516c57" />
          <path d="M8 35h34M25 5v53" stroke="#a6b18e" strokeOpacity=".4" />
        </svg>
      </div>
      {!sessions.length ? (
        <div className="empty-map">
          <MapIcon size={44} />
          <h2>Your frontier awaits.</h2>
          <p>
            Open a local CLI session to establish your first settlement.
            <br />
            Check journal locations in Connections, or explore the demo.
          </p>
        </div>
      ) : (
        <svg
          className="world-svg"
          viewBox={`${cx - width / 2} ${cy - height / 2} ${width} ${height}`}
          aria-label="Settlements arranged by repository and shared files"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, distance: 0 };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current) {
              const dx = e.clientX - drag.current.x,
                dy = e.clientY - drag.current.y;
              drag.current.distance = Math.hypot(dx, dy);
              const ratio = width / e.currentTarget.getBoundingClientRect().width;
              setPan({ x: drag.current.px + dx * ratio, y: drag.current.py + dy * ratio });
            }
          }}
          onPointerUp={(e) => {
            if (drag.current && drag.current.distance < 5) {
              const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-session]');
              if (el?.getAttribute('data-session')) onSelect(el.getAttribute('data-session')!);
            }
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <defs>
            <pattern id="mapDots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r=".7" fill="#7c9c76" opacity=".16" />
            </pattern>
          </defs>
          <rect
            x={cx - width / 2}
            y={cy - height / 2}
            width={width}
            height={height}
            fill="url(#mapDots)"
          />
          <g
            transform={`translate(${cx + pan.x} ${cy + pan.y}) scale(${zoom}) translate(${-cx} ${-cy})`}
          >
            {links.map(({ a, b, shared }) => {
              const p = point(cells.get(a.id)!),
                q = point(cells.get(b.id)!);
              return (
                <g key={`${a.id}-${b.id}`}>
                  <path
                    d={`M${p.x} ${p.y + 30} Q${(p.x + q.x) / 2} ${(p.y + q.y) / 2 + 50} ${q.x} ${q.y + 30}`}
                    fill="none"
                    stroke={shared ? '#d3bd80' : '#7d9870'}
                    strokeWidth={shared ? 3 : 1.5}
                    strokeDasharray="5 6"
                    opacity={selected === a.id || selected === b.id ? 0.8 : 0.35}
                  />
                  <title>{shared ? `${shared} shared files` : 'Same repository'}</title>
                </g>
              );
            })}
            {[...sessions]
              .sort((a, b) => point(cells.get(a.id)!).y - point(cells.get(b.id)!).y)
              .map((s) => {
                const p = point(cells.get(s.id)!);
                return (
                  <g
                    key={s.id}
                    data-session={s.id}
                    transform={`translate(${p.x} ${p.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${s.title}, ${s.agents.length} agents, ${s.status}`}
                    aria-pressed={selected === s.id}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(s.id);
                      }
                    }}
                    onMouseEnter={() => setHovered(s.id)}
                    onMouseLeave={() => setHovered(null)}
                    className="tile-target"
                  >
                    <Settlement session={s} selected={selected === s.id} />
                    {(hovered === s.id || selected === s.id) && (
                      <g className="map-bubble" transform="translate(0 -121)">
                        <rect x="-116" y="-22" width="232" height="29" rx="7" />
                        <path d="m-5 7 5 6 5-6" />
                        <text textAnchor="middle" y="-4">
                          {s.activity.split(' · ')[0].slice(0, 34)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
          </g>
        </svg>
      )}
      <div className="map-bottom">
        <span className="map-hint">
          Drag to explore <span>·</span> Select a settlement
        </span>
        <div className="map-controls">
          <button
            title={paused ? 'Resume animation' : 'Pause animation'}
            aria-label={paused ? 'Resume animation' : 'Pause animation'}
            onClick={onPause}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <i />
          <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}>
            <Minus size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>
            <Plus size={16} />
          </button>
          <i />
          <button
            aria-label="Reset map view"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Focus size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
