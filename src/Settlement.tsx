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
const RESOURCES = '/art/resources.png';
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

function ResourceScenery({
  kind,
  x,
  y,
  width,
}: {
  kind: 'quarry' | 'granary';
  x: number;
  y: number;
  width: number;
}) {
  return (
    <svg
      className={`resource-site resource-site-${kind}`}
      x={x - width / 2}
      y={y - width}
      width={width}
      height={width}
      viewBox={`${kind === 'quarry' ? 0 : 887} 0 887 887`}
      overflow="hidden"
      pointerEvents="none"
      aria-hidden="true"
    >
      <image href={RESOURCES} width="1774" height="887" />
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
  carrying,
  lead = false,
}: {
  faceLeft?: boolean;
  carrying?: 'stone' | 'grain';
  lead?: boolean;
}) {
  return (
    <g className={faceLeft ? 'face-left' : ''}>
      <g className="walk-body">
        <Pose frame={1} className="pose-primary" lead={lead} />
        <Pose frame={2} className="pose-secondary" lead={lead} />
        {carrying === 'stone' && (
          <g className="carried-stone" transform="translate(6 -16)" pointerEvents="none">
            <path
              d="m-7 2 2-7 6-2 6 4 2 6-6 3-8-1Z"
              fill="#969589"
              stroke="#4d5149"
              strokeWidth="1"
            />
            <path
              d="m-5-5 6-2 2 6-7 1M3-1l6 4-6 3"
              fill="#c5bdab"
              stroke="#777970"
              strokeWidth=".6"
            />
          </g>
        )}
        {carrying === 'grain' && (
          <g className="carried-grain" transform="translate(6 -16)" pointerEvents="none">
            <path
              d="M-5-4Q-7-1-6 4Q0 9 7 4Q8-1 5-4Z"
              fill="#d2b78a"
              stroke="#745937"
              strokeWidth="1"
            />
            <path d="M-5-4Q0-2 5-4M-2-5l-1-8M1-5v-10M4-5l2-7" stroke="#d4ad53" strokeWidth="1.2" />
            <path d="m-3-11-3-2m4 3 3-3m0 0-2-3m5 5 3-2" stroke="#e2c369" strokeWidth="1" />
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
  kind,
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
  kind?: string;
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
  const toolUse = working && (kind === 'tool' || (!kind && activity.startsWith('Using a tool ·')));
  const delegating =
    working && (kind === 'delegating' || (!kind && activity.startsWith('Delegating work')));
  const building =
    working &&
    !toolUse &&
    !delegating &&
    (kind
      ? ['building', 'testing', 'working'].includes(kind)
      : /build|edit|patch|writ|test|command|bash|shell|exec|powershell|terminal/i.test(activity));
  const harvesting = working && !building && !toolUse && !delegating;
  const traveling = harvesting || patrolling;
  // The route begins at the town hall steps and ends at the resource site's front edge.
  // Cottages sit farther south, clear of both paths.
  const doorways = [
    [14, 17],
    [8, 18],
    [20, 21],
    [4, 22],
    [17, 14],
    [2, 16],
    [24, 18],
    [10, 23],
  ];
  const [originX, originY] = harvesting ? doorways[index] : [x, y];
  // Reading/searching mines information; planning gathers grain. Both are metaphors,
  // but the worker now visibly visits the corresponding quarry or granary.
  const stoneTrip =
    kind === 'gathering' || (!kind && /read|search|inspect|research/i.test(activity));
  const patrolStops = [
    [78, 34],
    [-76, 23],
    [14, 17],
    [78, 34],
    [-76, 23],
    [14, 17],
    [-76, 23],
    [78, 34],
  ];
  const [destinationX, destinationY] = patrolling
    ? patrolStops[index]
    : stoneTrip
      ? [-76, 23]
      : [78, 34];
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
        className={`worker ${harvesting ? 'resource-route' : ''} ${patrolling ? 'idle-route' : ''} ${traveling ? 'walking' : ''} ${toolUse ? 'tool-action' : ''} ${delegating ? 'delegating-action' : ''}`}
        data-resource={harvesting ? (stoneTrip ? 'quarry' : 'granary') : undefined}
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
              <Pose frame={patrolling ? 0 : stoneTrip ? 6 : 7} lead={lead} />
            </g>
            <g className="route-return">
              <WalkingPose
                faceLeft={destinationX > originX}
                carrying={harvesting ? (stoneTrip ? 'stone' : 'grain') : undefined}
                lead={lead}
              />
            </g>
          </>
        ) : (
          <>
            {building && (
              <g className="build-site" transform="translate(13 1)" pointerEvents="none">
                <path d="M-4 1 8-4 19 0 7 5Z" fill="#625b48" stroke="#b5a481" strokeWidth=".8" />
                <path d="M0-5 10-9 19-6 9-2Z" fill="#ada38d" stroke="#574f40" strokeWidth=".8" />
                <path d="M0-5v6m10-10v7m9-4v6" stroke="#575344" strokeWidth=".8" />
                <path d="M-5-10 1-13M10-9 14-15" stroke="#916b3d" strokeWidth="1.5" />
              </g>
            )}
            <Pose frame={building ? 4 : 0} className={building ? 'pose-primary' : ''} lead={lead} />
            {building && <Pose frame={5} className="pose-secondary" lead={lead} />}
            {delegating && <path d="m8-22 11-3 2 11-11 3Z" fill="#e8d5a5" stroke="#674d32" />}
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
      <ResourceScenery kind="quarry" x={-76} y={18} width={46} />
      <ResourceScenery kind="granary" x={78} y={29} width={45} />
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
      {session.eventCount > 25 && <Scenery kind="cottage" x={-34} y={66} width={41} />}
      {session.eventCount > 65 && <Scenery kind="cottage" x={40} y={66} width={41} />}
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
          kind={a.kind}
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
