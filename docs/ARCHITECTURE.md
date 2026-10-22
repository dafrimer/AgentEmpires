# Architecture

## Data flow

```text
Local JSONL journals → bounded incremental Rust readers → harness adapters
                   → session/agent state → repository relationships
                   → Tauri IPC snapshots → map + inspector + companion
```

The Rust monitor owns file access. The frontend can request a snapshot, edit the four journal locations, reveal a source by its known session ID, and switch windows. No renderer shell permission, arbitrary file-reader command, remote navigation, or model credential is exposed.

## Monitor

- Scans the four configured roots every two seconds, recursively to depth 12 without following symlinks. Uses a selectable 1–168 hour window and up to 256 recent journals per harness. Discovery is bounded to 50,000 directory entries per root.
- Each reader tracks offset, a partial line, modification time, and a short prefix. Truncation, prefix changes, and same-length rewrites reset the projection. Each file reads at most 8 MiB per scan, records over 4 MiB are skipped, and errors are reported per adapter. Large backlogs catch up over multiple scans.
- A newline is required before a record is projected. UTF-8 is decoded only after the complete record arrives. Malformed records do not prevent later records from being read.
- Retains at most 30 recent activity entries, 256 paths, and 128 directly observed agents per journal. Shared-file connections use explicit path arguments and patch headers from the last 30 minutes; shell commands are not parsed as file lists.
- Repository grouping follows `.git` and worktree `commondir` files without executing repository commands. Repositories lacking a Git identity group by working directory. Separate clones with the same remote are not merged.
- Status reflects recorded events. Working/waiting observations older than two minutes become stale. There is no PID-based guarantee of liveness.
- Codex tool call IDs keep a still-running call visible when another call finishes. After the final result, the activity says the agent is reviewing that result; tool output is never copied into the snapshot.

## Adapter contracts and limitations

The serialized snapshot shape is in `src/types.ts`; Rust's corresponding structs are in `src-tauri/src/model.rs`. Each adapter takes an untrusted JSON value and updates a single journal projection. Unknown records are ignored.

Adapters extract an explicit session title where one is recorded and otherwise derive a bounded title from the first user request. A separate short task label follows the latest user request. Tool results are excluded from this extraction. Task labels, tool categories, and optional file basenames are displayed locally; short requests may appear entirely in their label. Command arguments and tool output are not serialized to the renderer. This is a best-effort summary of journal evidence, not a semantic interpretation of the agent's plans.

| Harness | Source                                                                 | Limitations                                                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex   | `session_meta`, `event_msg`, tool-call `response_item`                 | Local CLI and desktop journals. Private rollout format. Parent IDs are used only when explicitly present; guardian/review helpers are excluded.                                                       |
| Claude  | User/assistant journal records, tool-use blocks, turn-duration records | Older versions may omit an explicit end-of-turn marker. Child files establish the root-session relationship; deeper ancestry may be unavailable.                                                      |
| Copilot | `session.start`, turn/tool/permission/subagent events                  | Historical tool-call records without an agent ID cannot be reliably attributed to a child and are shown on the root.                                                                                  |
| OMP     | Session header, messages, custom tool-start/exit records               | Streaming output may not persist until completion. `parentSession` is a fork relation and is deliberately not treated as a worker relation. Companion child journals establish ancestry when present. |

Never use message `parentId`/`parentUuid` as an agent parent: these usually refer to conversation records. Missing child-parent metadata must be described as limited coverage rather than filled with guessed agents.

Known file-watching limits: an append combined with a middle-of-file rewrite that preserves the prefix can evade reset detection. Recursive discovery is bounded; very large histories and unavailable network/WSL paths should use a narrower root. No claim of complete capture across all harness versions is made.

## World layout and art

Axial hex coordinates avoid collisions. Existing tiles retain their coordinates for the current view; new tiles choose an adjacent free location minimizing repository/shared-file distance. File overlap is evidence of related activity, not a merge-conflict diagnosis. Filters can rebuild a filtered arrangement. The map supports pan, zoom, keyboard selection, reduced motion, and a persistent pause toggle.

SVG houses, trees, people, paths, terrain, flags, and smoke are authored in source. Building tiers are decorative thresholds of observed event count, not productivity scores. The lead uses an original paladin sprite; subagents without a journal name get deterministic distinct names. At most eight present workers are drawn per tile. Completed children leave the map after 12 seconds and stale workers are hidden; all observed workers remain listed in the inspector.

## Desktop shell

Two webviews share one Rust monitor. The main window shows the full map. The companion is a transparent, frameless, always-on-top window with a drag handle. Closing the main window shows the companion; Quit lives in the system tray/menu-bar menu. No launch-at-login changes are made automatically.

Source navigation resolves a session ID against the latest snapshot and passes its path as an OS command argument, never shell-interpolated text. Resume commands are quoted separately for POSIX and PowerShell, displayed/copied only, and do not run automatically.

## Upstream references

- [Codex app-server read-only thread APIs](https://developers.openai.com/codex/app-server/) — future supported API integration; this version does not create or resume an app-server session.
- [Claude Code hooks](https://code.claude.com/docs/en/hooks) and [CLI reference](https://code.claude.com/docs/en/cli-reference).
- [Copilot event types](https://github.com/github/copilot-sdk/blob/main/nodejs/src/generated/session-events.ts) and [CLI reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference).
- [Oh My Pi session format](https://github.com/can1357/oh-my-pi/blob/main/docs/session.md) and [artifact layout](https://github.com/can1357/oh-my-pi/blob/main/docs/blob-artifact-architecture.md).
- [Tauri configuration](https://v2.tauri.app/reference/config/) and [desktop prerequisites](https://v2.tauri.app/start/prerequisites/).
