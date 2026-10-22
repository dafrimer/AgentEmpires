# AgentEmpires

**Your agents, alive.** A quiet desktop world for the coding agents working on your machine.

AgentEmpires turns local **Codex CLI and desktop, Claude Code, GitHub Copilot CLI, and Oh My Pi** sessions into medieval settlements on a hex map. Each real agent becomes a settler. Reading and planning gather supplies; editing and command execution build the village; other tool calls use an instrumented workbench. Codex settlement labels follow the visible chat name from its local state database, including renames. Other labels use an explicit journal title when available, or a short label inferred from the first user request. The current request and observed action appear in the map and detail panel.

![AgentEmpires demo world](docs/world.png)

## The world

- One settlement per local journal session, with a distinct banner color for each harness.
- Workers represent observed agents and subagents. The lead wears distinct paladin armor; subagents receive stable, unique names when the journal does not provide one. The inspector preserves known parent relationships.
- Related repositories attract neighboring tiles. Shared file activity creates stronger connections. Git worktrees share a repository identity.
- A transparent, always-on-top desktop companion can be moved by dragging its top bar. It follows the busiest observed settlement by default; up/down arrows cycle and pin a settlement, and AUTO resumes automatic selection. It keeps its position when switching views and expands to the full map on double-click. The tray/menu-bar menu brings either view back.
- Search, harness filters, active-only view, pan, zoom, activity bubbles, and a local chronicle.
- Hover over a worker to see that individual agent's current activity. Demo mode and selection stay in sync between the map and companion.
- Reading and searching send villagers from the hall steps to a quarry; planning sends them to a granary beside the wheat field. Returning workers carry visible stone or grain. Their walking and return trips use alternating foot poses. Idle subagents make quiet rounds only while the settlement is working. A resting settlement stops walking, and completed workers leave the map after a brief pause while remaining in the inspector; editing, shell commands, and tests use hammer poses, while waiting agents stay in place.
- Other observed tool calls use a four-pose workshop animation. Their activity bubbles retain the tool name without revealing its arguments.
- Construction grows with observed activity; it is decorative and **does not claim a percentage of task completion**.
- Reveal the original journal in Finder/Explorer, or copy a resume command for your terminal.
- Demo mode is clearly labeled and never mixed with live activity.
- Reduced-motion support and a persistent animation pause control.

## Run locally

Requirements: Node.js **24**, stable Rust, and the [Tauri desktop prerequisites](https://v2.tauri.app/start/prerequisites/). macOS needs Xcode Command Line Tools. Windows needs the Visual Studio C++ build tools and WebView2.

```sh
git clone https://github.com/dafrimer/AgentEmpires.git
cd AgentEmpires
npm ci
npm run desktop
```

Open the app, then start your local agents as usual. Use **Connections and settings** to change journal roots or extend the lookback from 24 hours to seven days. Environment overrides for `CODEX_HOME` and `CLAUDE_CONFIG_DIR` are honored at startup.

For the visual demo without Rust:

```sh
npm ci
npm run dev
```

The browser preview uses simulated data. Only the desktop app reads local journals.

### Build installers

```sh
# macOS: app and disk image
npm run tauri build -- --bundles app,dmg

# Windows: NSIS installer
npm run tauri build -- --bundles nsis
```

CI builds **macOS Apple Silicon, macOS Intel, and Windows x64**, runs Rust tests on all three, and uploads installers as workflow artifacts. Alpha prereleases may package these artifacts as clearly labeled unsigned test builds. A stable public launch requires the native checklist in [release verification](docs/RELEASE.md), including signing and installation checks on both operating systems.

## Connecting the four kingdoms

| Harness               | Default journal directory  | Observed relationships                                                                                  |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Codex CLI and desktop | `~/.codex/sessions`        | Subagent parent IDs in journals; visible chat names in the adjacent read-only `state_5.sqlite` database |
| Claude Code           | `~/.claude/projects`       | Child journals in a session's `subagents` directory                                                     |
| Copilot CLI           | `~/.copilot/session-state` | Subagent lifecycle and agent IDs in `events.jsonl`                                                      |
| Oh My Pi              | `~/.omp/agent/sessions`    | Child journals in companion artifact directories                                                        |

On Windows, `~` means your user profile directory. Custom profiles and WSL installations need an explicitly accessible journal path. Remote and cloud sessions are outside this version's scope. Codex desktop chats with a local journal are observed; internal guardian/review helper journals are excluded.

### What “live” means

The monitor polls journals every two seconds and reads appended records incrementally. It is an **activity observer**, not a process supervisor. A recently written tool call means work was observed; it does not prove that a process is still alive. After two minutes without relevant activity, working/waiting agents become **Last seen**. Idle and closed states come from journal events. Finished child turns count as completed assignments; those workers leave the map after 12 seconds, while the inspector retains their history. A long-running tool may therefore become Last seen until another event is written.

Journals are private harness implementation formats and may change. Some tools buffer events or do not persist subagent ancestry. AgentEmpires shows only what it can establish, never invents workers from conversation branches, and keeps adapter limitations in [the architecture notes](docs/ARCHITECTURE.md). Missing parents are not shown as independent sessions.

“Reveal source journal” reveals the file location. Focusing an arbitrary terminal tab is not portable. Resume commands are provided for use **after the original session stops**, and are never executed by AgentEmpires.

## Privacy

No accounts, hosted backend, telemetry, model API calls, or network requests in the application. Session data stays in memory. Codex display names are read locally from its state database with a read-only connection. Short, bounded excerpts extracted locally from user requests are sent to the renderer to show the current task and fallback session name; a short request may fit entirely in its label. Reasoning, tool results, and command arguments are not sent. Observed-action descriptions come from tool names and optional filenames, never command output. Titles, task labels, repository names, local paths, and observed filenames can still be sensitive and appear locally in the UI. App settings are the only data saved by the backend. No harness settings, state database, or journals are modified.

## Development

```sh
npm test
npm run build
npx playwright install chromium
npm run test:ui
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

`cargo run --manifest-path src-tauri/Cargo.toml --example inspect` prints a read-only seven-day discovery summary (counts only). Pass a raw session ID after `--` to check whether that top-level session is present, without printing journal content. The built desktop executable's `--smoke-test` option opens both native windows, checks switching, and exits; it uses isolated temporary settings and no real journal roots.

The core is Rust; the interface is React, TypeScript, and original isometric raster sprites layered in SVG inside Tauri 2. See [architecture](docs/ARCHITECTURE.md) and [contributing](CONTRIBUTING.md).

## License and artwork

MIT. Settlements use original generated isometric sprites, textured terrain, and animated villager poses inspired by classic medieval strategy games. See the [asset notes and generation prompts](public/art/README.md). No Catan or Age of Empires assets are included. AgentEmpires is an independent project, unaffiliated with the harness vendors or those games.
