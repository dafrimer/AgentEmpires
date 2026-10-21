import type { Session } from './types';
import { HARNESSES } from './types';

function Tree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <ellipse cy="5" rx="10" ry="5" fill="#263d31" opacity=".3" />
      <path d="M-2 0h4v9h-4z" fill="#684f39" />
      <path
        d="M0-34 13-9 7-10 17 3 0 9-17 3-8-10-13-9Z"
        fill="#365444"
        stroke="#293f34"
        strokeWidth="1.4"
      />
      <path d="M0-34 0 9-17 3-8-10-13-9Z" fill="#4d6e4d" />
      <path
        d="m0-25-8 16 8 3M0-14-12 16"
        fill="none"
        stroke="#729265"
        strokeWidth="1"
        opacity=".4"
      />
    </g>
  );
}
function House({
  x,
  y,
  color,
  large = false,
}: {
  x: number;
  y: number;
  color: string;
  large?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${large ? 1.25 : 0.8})`}>
      <ellipse cy="18" rx="34" ry="14" fill="#263a2d" opacity=".25" />
      <path
        d="M-23-10 7-24 30-11 30 15 1 29-23 16Z"
        fill="#d4c3a0"
        stroke="#3e4937"
        strokeWidth="1.5"
      />
      <path d="M1 2 30-11V15L1 29Z" fill="#9c9b7a" />
      <path d="M-23-10 1 2V29L-23 16Z" fill="#c5b894" />
      <path d="m-30-9 25-34 40 21-30 30Z" fill={color} stroke="#3e4937" strokeWidth="2" />
      <path d="M-5-43 9-13 35-22Z" fill="#43594a" opacity=".45" />
      <path d="m-23-12 24 12M-19-20 26-6M-13-29 22-12" stroke="#374638" opacity=".3" fill="none" />
      <path d="M-16 1-9 5v17l-7-4ZM9 7l8-4v10l-8 4Z" fill="#384c3e" />
      <path d="m10 8 6-3v7l-6 3Z" fill="#e8c879" />
      <path
        d="M-23-10V16M1 2V29M30-11V15M-23 7 1 20 30 6M-3 1V25"
        fill="none"
        stroke="#665c44"
        strokeWidth="2"
      />
      {large && (
        <>
          <path d="M-5-43v-29" stroke="#ddcea6" strokeWidth="2" />
          <path className="flag" d="M-4-71 15-66-4-59Z" fill={color} />
          <path d="M20-30v-18l6 3v18" fill="#a89e83" stroke="#4b5141" />
          <g className="smoke" fill="#e0d8bb" opacity=".35">
            <circle cx="23" cy="-54" r="4" />
            <circle cx="26" cy="-64" r="5" />
            <circle cx="24" cy="-77" r="7" />
          </g>
        </>
      )}
    </g>
  );
}
function Worker({
  x,
  y,
  color,
  index,
  working,
  waiting,
  name,
  activity,
}: {
  x: number;
  y: number;
  color: string;
  index: number;
  working: boolean;
  waiting: boolean;
  name: string;
  activity: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        className={working ? 'worker walking' : 'worker'}
        style={{ animationDelay: `-${index * 1.7}s`, animationDuration: `${7 + (index % 3)}s` }}
      >
        <title>{`${name}: ${activity}`}</title>
        <ellipse cy="5" rx="6" ry="3" fill="#233a2e" opacity=".35" />
        <path d="m-2-2-2 7m6-7 2 7" stroke="#394d3d" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M-4-10h8l1 10H-5Z" fill={color} stroke="#344936" strokeWidth="1" />
        <circle cy="-14" r="4" fill="#ddc19a" />
        <path d="M-5-16h10L2-20H-2Z" fill="#e1c88a" />
        {working && (
          <g className="tool">
            <path d="m4-6 7-8" stroke="#a99c74" strokeWidth="2" />
            <path d="m7-16 6 5" stroke="#c7c9b1" strokeWidth="2.5" />
          </g>
        )}
        {waiting && (
          <g>
            <circle cy="-30" r="7" fill="#edc77e" />
            <text y="-27" textAnchor="middle" fill="#3e4532" fontSize="11" fontWeight="800">
              !
            </text>
          </g>
        )}
        <g className="worker-speech" pointerEvents="none">
          <rect x="-88" y="-65" width="176" height="35" rx="5" fill="#14291d" stroke="#b7c797" />
          <path d="m-4-30 4 5 4-5" fill="#14291d" stroke="#b7c797" />
          <text y="-52" textAnchor="middle" fill="#e0e7ce" fontSize="9">
            {name.slice(0, 28)}
          </text>
          <text y="-40" textAnchor="middle" fill="#aabc91" fontSize="8">
            {activity.split(' · ')[0].slice(0, 34)}
          </text>
        </g>
      </g>
    </g>
  );
}
export default function Settlement({
  session,
  selected = false,
  compact = false,
}: {
  session: Session;
  selected?: boolean;
  compact?: boolean;
}) {
  const h = HARNESSES[session.harness];
  const working = session.agents.some((a) => a.status === 'working');
  const positions = [
    [38, 30],
    [-38, 20],
    [0, 45],
    [54, -6],
    [-56, -12],
    [65, 34],
    [-20, 55],
    [24, -25],
  ];
  return (
    <g className={`settlement ${working ? 'is-working' : ''} ${selected ? 'selected' : ''}`}>
      <ellipse cy="30" rx="104" ry="73" fill="#091e18" opacity=".3" />
      <path d="M-110 0v23l55 41L0 96l110-65V0Z" fill="#374c3a" stroke="#1e392f" strokeWidth="2" />
      <path d="M0 78v18l110-65V13Z" fill="#2a4335" />
      <path
        d="M0-79 110-39 110 39 0 79-110 39-110-39Z"
        fill={h.terrain}
        stroke={selected ? '#e3d2a5' : '#304f3c'}
        strokeWidth={selected ? 3 : 2}
      />
      <path d="M0-74 104-36v72L0 73-104 36v-72Z" fill="none" stroke="#d9e0b6" strokeOpacity=".14" />
      <path
        d="M-75-18Q-15 0 65 40M-25 52Q-5 13 35-38"
        stroke="#c3b58b"
        strokeWidth="13"
        fill="none"
        opacity=".5"
      />
      <path
        d="M-75-18Q-15 0 65 40M-25 52Q-5 13 35-38"
        stroke="#e0d2a4"
        strokeWidth="2"
        strokeDasharray="2 6"
        fill="none"
        opacity=".35"
      />
      <g opacity=".55" stroke="#b5bf82" strokeWidth="1.3">
        <path d="m-91 16 2-5 2 4m69-64 2-5 3 4m77 52 2-6 2 5m-34 48 2-5 3 4m-92-43 2-4 2 4m58 51 2-5 2 4" />
      </g>
      <g transform="translate(64 -19)">
        <path d="m-18 0 22-10 17 8-23 12Z" fill="#756a41" />
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`m${-12 + i * 6} ${1 - i * 2.8} 13 6`}
            stroke="#c6b267"
            strokeWidth="3"
          />
        ))}
        <path d="m-18 1 21 11 19-11" fill="none" stroke="#a3a16d" strokeWidth="2" />
      </g>
      <Tree x={-64} y={-32} size={0.8} />
      <Tree x={-86} y={-16} size={0.65} />
      <Tree x={-46} y={-47} size={0.64} />
      <House x={-3} y={-12} color={h.color} large />
      {session.eventCount > 25 && <House x={-51} y={17} color={h.color} />}
      {session.eventCount > 65 && <House x={61} y={19} color={h.color} />}
      <g transform="translate(-65 38)" fill="#aab1a0" stroke="#56694e">
        <path d="m-10 0 4-7 9 1 4 7-8 4Z" />
        <path d="m0 4 4-7 10 1 4 6-10 4Z" />
      </g>
      <Tree x={-78} y={33} size={0.6} />
      <Tree x={81} y={-4} size={0.5} />
      {session.agents.slice(0, 8).map((a, i) => (
        <Worker
          key={a.id}
          x={positions[i][0]}
          y={positions[i][1]}
          color={h.color}
          index={i}
          working={a.status === 'working'}
          waiting={a.status === 'waiting'}
          name={a.name}
          activity={a.activity}
        />
      ))}
      {session.agents.length > 8 && (
        <text x="65" y="56" fontSize="11" fill="#f3ebcf">
          +{session.agents.length - 8}
        </text>
      )}
      {!compact && (
        <g transform="translate(0 105)">
          <rect
            x="-72"
            y="-12"
            width="144"
            height="25"
            rx="12"
            fill="#172e25"
            stroke={selected ? '#a7b893' : '#526b52'}
          />
          <circle cx="-57" r="3" fill={h.color} />
          <text x="4" y="4" textAnchor="middle" fontSize="10" letterSpacing="1" fill="#e2e4d0">
            {session.repoName.toUpperCase().slice(0, 20)}
          </text>
        </g>
      )}
    </g>
  );
}
