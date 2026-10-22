import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { Session, Status } from './types';
import { HARNESSES } from './types';
import { settlersOnMap } from './world';

const HEX = 'M0-79 110-39 110 39 0 79-110 39-110-39Z';
const ENVIRONMENT = '/art/environment.png';
const VILLAGERS = '/art/villagers.png';
const PALADIN = '/art/paladin.png';
const TOOL_WORKBENCH = '/art/tool-workbench.png';
// Explicit atlas regions preserve transparent margins without preprocessing the source art.
const REGIONS = {
  hall: [0, 0, 655, 610],
  cottage: [655, 0, 599, 610],
  forest: [0, 610, 610, 644],
  farm: [610, 610, 644, 644],
} as const;

function Scenery({
  kind,
  x,
  y,
  width,
}: {
  kind: keyof typeof REGIONS;
  x: number;
  y: number;
  width: number;
}) {
  const [sx, sy, sw, sh] = REGIONS[kind];
  const height = (width * sh) / sw;
  return (
    <svg
      x={x - width / 2}
      y={y - height}
      width={width}
      height={height}
      viewBox={`${sx} ${sy} ${sw} ${sh}`}
      overflow="hidden"
      pointerEvents="none"
      aria-hidden="true"
    >
      <image href={ENVIRONMENT} width="1254" height="1254" />
    </svg>
  );
}

function Pose({
  frame,
  className = '',
  lead = false,
}: {
  frame: number;
  className?: string;
  lead?: boolean;
}) {
  return (
    <svg
      className={className}
      x="-14"
      y="-33"
      width="28"
      height="37.33"
      viewBox={`${(frame % 4) * 384} ${Math.floor(frame / 4) * 512} 384 512`}
      overflow="hidden"
      pointerEvents="none"
      aria-hidden="true"
    >
      <image href={lead ? PALADIN : VILLAGERS} width="1536" height="1024" />
    </svg>
  );
}

function ToolPose({ frame }: { frame: number }) {
  return (
    <svg
      className={`tool-frame tool-frame-${frame}`}
      x="-28"
      y="-51"
      width="56"
      height="56"
      viewBox={`${(frame % 2) * 627} ${Math.floor(frame / 2) * 627} 627 627`}
      overflow="hidden"
      pointerEvents="none"
      aria-hidden="true"
    >
      <image href={TOOL_WORKBENCH} width="1254" height="1254" />
    </svg>
  );
}

function WalkingPose({
  faceLeft = false,
  carrying = false,
  lead = false,
}: {
  faceLeft?: boolean;
  carrying?: boolean;
  lead?: boolean;
}) {
  return (
    <g className={faceLeft ? 'face-left' : ''}>
      <g className="walk-body">
        <Pose frame={1} className="pose-primary" lead={lead} />
        <Pose frame={2} className="pose-secondary" lead={lead} />
        {carrying && (
          <g className="carried-supplies" transform="translate(5 -16)" pointerEvents="none">
            <ellipse rx="8" ry="4" fill="#745334" stroke="#cfac73" strokeWidth="1" />
            <path d="M-5-2 4 2M-2-3 7 1" stroke="#dec28c" strokeWidth="1" />
          </g>
        )}
      </g>
    </g>
  );
}

function Worker({
  x,
  y,
  color,
  index,
  status,
  name,
  activity,
  lead,
  sessionStatus,
}: {
  x: number;
  y: number;
  color: string;
  index: number;
  status: Status;
  name: string;
  activity: string;
  lead: boolean;
  sessionStatus: Status;
}) {
  const working = status === 'working';
  const waiting = status === 'waiting';
  // Idle subagents can make quiet rounds while the lead is still working.
  // A finished settlement rests, and completed workers never keep patrolling.
  const patrolling = status === 'idle' && sessionStatus === 'working' && !lead;
  // Shell and test execution also count as construction on the board. The
  // activity bubble keeps the more precise label from the journal adapter.
  const toolUse =
    working && (activity.startsWith('Using a tool ·') || activity.startsWith('Delegating work'));
  const building =
    working &&
    !toolUse &&
    /build|edit|patch|writ|inspect|test|command|bash|shell|exec|powershell|workshop|terminal/i.test(
      activity,
    );
  const harvesting = working && !building && !toolUse;
  const traveling = harvesting || patrolling;
  // These are visible routes on the board: the front of the hall to the farm or forest.
  // Each villager has a slightly different doorway and departure time, so several agents
  // can move at once without occupying exactly the same point.
  const doorways = [
    [-12, 40],
    [13, 42],
    [0, 53],
    [26, 48],
    [-22, 53],
    [7, 61],
    [-9, 48],
    [23, 59],
  ];
  const [originX, originY] = harvesting ? doorways[index] : [x, y];
  const forestTrip = index % 2 === 1;
  const patrolStops = [
    [53, 43],
    [-52, 34],
    [25, 53],
    [49, 23],
    [-51, 25],
    [42, 45],
    [-22, 50],
    [52, -10],
  ];
  const [destinationX, destinationY] = patrolling
    ? patrolStops[index]
    : forestTrip
      ? [-75, 13]
      : [72, 30];
  const routeDuration = `${patrolling ? 7.5 + (index % 3) : 8.5 + (index % 3)}s`;
  const routeDelay = `-${index * 1.9}s`;
  const routeStyle = {
    '--route-x': `${destinationX - originX}px`,
    '--route-y': `${destinationY - originY}px`,
    '--route-duration': routeDuration,
    '--route-delay': routeDelay,
    '--pose-delay': `-${index * 0.17}s`,
  } as CSSProperties;
  return (
    <g transform={`translate(${originX} ${originY})`}>
      <g
        className={`worker ${harvesting ? 'resource-route' : ''} ${patrolling ? 'idle-route' : ''} ${traveling ? 'walking' : ''} ${toolUse ? 'tool-action' : ''}`}
        style={routeStyle}
      >
        <title>{`${name}: ${activity}`}</title>
        <ellipse
          className="foot-shadow"
          cy="3"
          rx={toolUse ? 22 : 7}
          ry={toolUse ? 5 : 2.8}
          fill="#152819"
          opacity=".45"
        />
        <ellipse
          cy="3"
          rx={toolUse ? 22 : 7}
          ry={toolUse ? 5 : 2.8}
          fill="none"
          stroke={color}
          strokeWidth=".8"
          opacity=".8"
        />
        {toolUse && lead ? (
          <g className="lead-workshop">
            <path d="M5-9 23-15 30-10 12-3Z" fill="#6e4b2d" stroke="#d4ad70" strokeWidth="1" />
            <path d="M12-8 22-11 26-9 16-6Z" fill="#dfd0a5" />
            <path className="compass-arm" d="M18-8 22-12" stroke="#d7bb68" strokeWidth="1.5" />
            <Pose frame={0} lead />
          </g>
        ) : toolUse ? (
          <>
            {[0, 1, 2, 3].map((frame) => (
              <ToolPose key={frame} frame={frame} />
            ))}
          </>
        ) : traveling ? (
          <>
            <g className="route-outbound">
              <WalkingPose faceLeft={destinationX < originX} lead={lead} />
            </g>
            <g className="route-harvest">
              <Pose frame={patrolling ? 0 : forestTrip ? 6 : 7} lead={lead} />
            </g>
            <g className="route-return">
              <WalkingPose faceLeft={destinationX > originX} carrying={harvesting} lead={lead} />
            </g>
          </>
        ) : (
          <>
            <Pose frame={building ? 4 : 0} className={building ? 'pose-primary' : ''} lead={lead} />
            {building && <Pose frame={5} className="pose-secondary" lead={lead} />}
          </>
        )}
        <rect
          className="worker-hit"
          x={toolUse ? -28 : -12}
          y={toolUse ? -51 : -32}
          width={toolUse ? 56 : 24}
          height={toolUse ? 57 : 38}
          fill="transparent"
        />
        {waiting && (
          <g pointerEvents="none">
            <circle cy="-39" r="7" fill="#edc77e" stroke="#5a4828" />
            <text y="-36" textAnchor="middle" fill="#3e4532" fontSize="11" fontWeight="800">
              !
            </text>
          </g>
        )}
        <g className="worker-speech" pointerEvents="none">
          <rect x="-88" y="-79" width="176" height="35" rx="5" fill="#14291d" stroke="#b7c797" />
          <path d="m-4-44 4 5 4-5" fill="#14291d" stroke="#b7c797" />
          <text y="-66" textAnchor="middle" fill="#e0e7ce" fontSize="9">
            {name.slice(0, 28)}
          </text>
          <text y="-54" textAnchor="middle" fill="#aabc91" fontSize="8">
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
  const id = useId().replace(/:/g, '');
  const h = HARNESSES[session.harness];
  const present = settlersOnMap(session);
  const working = session.agents.some((a) => a.status === 'working');
  const positions = [
    [28, 40],
    [-26, 31],
    [0, 62],
    [71, 10],
    [-71, 13],
    [64, 49],
    [-43, 58],
    [38, -23],
  ];
  return (
    <g className={`settlement ${working ? 'is-working' : ''} ${selected ? 'selected' : ''}`}>
      <defs>
        <clipPath id={`${id}-land`}>
          <path d={HEX} />
        </clipPath>
        <linearGradient id={`${id}-earth`} x2="0" y2="1">
          <stop stopColor="#70684a" />
          <stop offset="1" stopColor="#3c3c2b" />
        </linearGradient>
      </defs>
      <ellipse cy="30" rx="112" ry="74" fill="#081a12" opacity=".45" />
      <path d="M-110-3v23l110 76 110-57V-3Z" fill={`url(#${id}-earth)`} stroke="#263429" />
      <path d="M0 79v17l110-57V39Z" fill="#222d22" opacity=".5" />
      <g clipPath={`url(#${id}-land)`}>
        <image
          href="/art/meadow.png"
          x="-110"
          y="-79"
          width="220"
          height="158"
          preserveAspectRatio="none"
        />
        <path d={HEX} fill={h.terrain} opacity=".18" />
        <path
          d="M-78-14Q-25 8 72 42M-23 66Q0 19 43-40"
          stroke="#736440"
          strokeWidth="12"
          fill="none"
          opacity=".5"
        />
        <path
          d="M-78-14Q-25 8 72 42M-23 66Q0 19 43-40"
          stroke="#baa774"
          strokeWidth="8"
          fill="none"
          opacity=".45"
        />
        <path
          d="M-78-14Q-25 8 72 42M-23 66Q0 19 43-40"
          stroke="#ddcda1"
          strokeWidth="2"
          strokeDasharray="1 3"
          fill="none"
          opacity=".3"
        />
      </g>
      <path
        d={HEX}
        fill="none"
        stroke={selected ? '#f1db9e' : h.color}
        strokeWidth={selected ? 2.5 : 1.25}
        strokeOpacity={selected ? 1 : 0.65}
      />
      <Scenery kind="forest" x={-67} y={-14} width={67} />
      <Scenery kind="farm" x={65} y={8} width={65} />
      <Scenery kind="hall" x={-2} y={9} width={116} />
      <g transform="translate(34 -54)" pointerEvents="none">
        <path d="M0-21v30" stroke="#d1bd8b" strokeWidth="1.4" />
        <path
          className="flag"
          d="M1-20 16-17 12-10 1-12Z"
          fill={h.color}
          stroke="#48513a"
          strokeWidth=".6"
        />
        <text x="7" y="-13" textAnchor="middle" fontSize="6" fill="#263629">
          {h.mark}
        </text>
      </g>
      {session.eventCount > 25 && <Scenery kind="cottage" x={-52} y={38} width={61} />}
      {session.eventCount > 65 && <Scenery kind="cottage" x={66} y={49} width={54} />}
      <Scenery kind="forest" x={-83} y={48} width={38} />
      {present.slice(0, 8).map((a, i) => (
        <Worker
          key={a.id}
          x={positions[i][0]}
          y={positions[i][1]}
          color={h.color}
          index={i}
          status={a.status}
          name={a.name}
          activity={a.activity}
          lead={!a.parentId}
          sessionStatus={session.status}
        />
      ))}
      {present.length > 8 && (
        <text x="65" y="67" fontSize="11" fill="#f3ebcf">
          +{present.length - 8}
        </text>
      )}
      {!compact && (
        <g transform="translate(0 112)">
          <rect
            x="-94"
            y="-12"
            width="188"
            height="25"
            rx="4"
            fill="#172e25"
            stroke={selected ? '#c4b47c' : '#526b52'}
          />
          <circle cx="-79" r="3" fill={h.color} />
          <text x="4" y="4" textAnchor="middle" fontSize="10" letterSpacing="1" fill="#e2e4d0">
            {session.title.toUpperCase().slice(0, 27)}
          </text>
        </g>
      )}
    </g>
  );
}
