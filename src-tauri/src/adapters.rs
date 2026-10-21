//! Read-only, best-effort adapters for local journals. Never run harness tools.
use crate::model::{Harness, Session, Status};
use serde_json::Value;

fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}
fn time(v: &Value) -> i64 {
    v.get("timestamp")
        .and_then(|t| {
            t.as_i64().or_else(|| {
                t.as_str()
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|t| t.timestamp_millis())
            })
        })
        .unwrap_or(0)
}
fn clean(text: &str, max: usize) -> String {
    text.chars().filter(|c| !c.is_control()).take(max).collect()
}
fn json_args(v: &Value) -> Value {
    if let Some(text) = v.as_str() {
        serde_json::from_str(text).unwrap_or(Value::Null)
    } else {
        v.clone()
    }
}
fn classify(name: &str, args: &Value) -> (&'static str, &'static str) {
    let name = name.to_lowercase();
    if name.contains("ask") || name.contains("request_user_input") {
        return ("waiting", "Awaiting your guidance");
    }
    if name.contains("spawn") || name == "task" || name == "agent" || name.contains("subagent") {
        return ("delegating", "Rallying the workers");
    }
    if name.contains("read")
        || name.contains("search")
        || name.contains("grep")
        || name.contains("glob")
        || name.contains("find")
    {
        return ("gathering", "Gathering knowledge");
    }
    if name.contains("write") || name.contains("edit") || name.contains("patch") {
        return ("building", "Building the settlement");
    }
    if name.contains("test") {
        return ("testing", "Inspecting the defenses");
    }
    if name.contains("bash")
        || name.contains("shell")
        || name.contains("exec")
        || name.contains("powershell")
    {
        let cmd = s(args, "command").to_owned() + s(args, "cmd");
        if ["test", "pytest", "vitest", "cargo check", "tsc", "lint"]
            .iter()
            .any(|x| cmd.contains(x))
        {
            return ("testing", "Inspecting the defenses");
        }
        if ["build", "compile", "install"]
            .iter()
            .any(|x| cmd.contains(x))
        {
            return ("building", "Upgrading the workshop");
        }
        return ("working", "Working at the workshop");
    }
    ("thinking", "Planning the next move")
}
fn tool(session: &mut Session, name: &str, args: &Value, agent: Option<&str>, at: i64) {
    let args = json_args(args);
    let (kind, text) = classify(name, &args);
    for key in ["file_path", "path", "filePath", "file"] {
        if let Some(p) = args
            .get(key)
            .and_then(Value::as_str)
            .filter(|p| p.len() < 4096 && !p.is_empty())
        {
            session.files.insert(p.into(), at);
        }
    }
    // Patch headers expose file names without retaining diffs or command arguments.
    for patch in [
        s(&args, "patch"),
        s(&args, "input"),
        args.as_str().unwrap_or(""),
    ] {
        for line in patch.lines() {
            for prefix in ["*** Update File: ", "*** Add File: ", "*** Delete File: "] {
                if let Some(path) = line.strip_prefix(prefix) {
                    session.files.insert(clean(path, 4096), at);
                }
            }
        }
    }
    while session.files.len() > 256 {
        let oldest = session
            .files
            .iter()
            .min_by_key(|(_, at)| *at)
            .map(|(p, _)| p.clone())
            .unwrap();
        session.files.remove(&oldest);
    }
    let status = if kind == "waiting" {
        Status::Waiting
    } else {
        Status::Working
    };
    session.record(
        agent,
        status,
        format!("{text} · {}", clean(name, 50)),
        kind,
        at,
    );
}

pub fn ingest(session: &mut Session, v: &Value) {
    let at = time(v);
    match session.harness {
        Harness::Codex => codex(session, v, at),
        Harness::Claude => claude(session, v, at),
        Harness::Copilot => copilot(session, v, at),
        Harness::Omp => omp(session, v, at),
    }
}
fn codex(out: &mut Session, v: &Value, at: i64) {
    let p = &v["payload"];
    match s(v, "type") {
        "session_meta" => {
            out.identify(s(p, "id"));
            out.cwd = s(p, "cwd").into();
            out.excluded = matches!(
                p["source"].as_str(),
                Some("vscode" | "appServer" | "app-server")
            );
            if let Some(parent) = p
                .pointer("/source/subagent/thread_spawn/parent_thread_id")
                .and_then(Value::as_str)
            {
                out.parent_session = Some(parent.into());
            }
            // Guardian / review helpers are not top-level CLI sessions.
            if p["source"].is_object() && out.parent_session.is_none() {
                out.excluded = true;
            }
        }
        "event_msg" => match s(p, "type") {
            "task_started" | "user_message" => out.record(
                None,
                Status::Working,
                "Planning the next move".into(),
                "thinking",
                at,
            ),
            "task_complete" | "task_completed" => out.record(
                None,
                Status::Idle,
                "Turn finished · resting by the fire".into(),
                "idle",
                at,
            ),
            "turn_aborted" => out.record(None, Status::Idle, "Turn interrupted".into(), "idle", at),
            "error" => out.record(
                None,
                Status::Error,
                "The agent reported an error".into(),
                "error",
                at,
            ),
            _ => {}
        },
        "response_item" => match s(p, "type") {
            "function_call" => tool(out, s(p, "name"), &p["arguments"], None, at),
            "custom_tool_call" => {
                let args = serde_json::json!({"input":s(p,"input")});
                tool(out, s(p, "name"), &args, None, at);
            }
            "function_call_output" | "custom_tool_call_output" => out.record(
                None,
                Status::Working,
                "Tool finished · planning next step".into(),
                "thinking",
                at,
            ),
            _ => {}
        },
        _ => {}
    }
}
fn claude(out: &mut Session, v: &Value, at: i64) {
    if !s(v, "sessionId").is_empty() {
        if out.source_path.replace('\\', "/").contains("/subagents/") {
            out.parent_session = Some(s(v, "sessionId").into());
            let id = std::path::Path::new(&out.source_path)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            out.identify(&format!("{}:{id}", s(v, "sessionId")));
        } else {
            out.identify(s(v, "sessionId"));
        }
    }
    if !s(v, "cwd").is_empty() {
        out.cwd = s(v, "cwd").into();
    }
    let message = &v["message"];
    match s(v, "type") {
        "user" => {
            let result = message["content"]
                .as_array()
                .is_some_and(|bs| bs.iter().any(|b| s(b, "type") == "tool_result"));
            out.record(
                None,
                Status::Working,
                if result {
                    "Tool finished · planning next step"
                } else {
                    "Planning the next move"
                }
                .into(),
                "thinking",
                at,
            );
        }
        "assistant" => {
            let mut has_tool = false;
            if let Some(blocks) = message["content"].as_array() {
                for b in blocks {
                    if s(b, "type") == "tool_use" {
                        tool(out, s(b, "name"), &b["input"], None, at);
                        has_tool = true;
                    }
                }
            }
            if !has_tool && s(message, "stop_reason") == "end_turn" {
                out.record(
                    None,
                    Status::Idle,
                    "Turn finished · resting by the fire".into(),
                    "idle",
                    at,
                );
            } else if !has_tool {
                out.record(
                    None,
                    Status::Working,
                    "Planning the next move".into(),
                    "thinking",
                    at,
                );
            }
        }
        "system" if s(v, "subtype") == "turn_duration" => out.record(
            None,
            Status::Idle,
            "Turn finished · resting by the fire".into(),
            "idle",
            at,
        ),
        _ => {}
    }
}
fn copilot(out: &mut Session, v: &Value, at: i64) {
    let d = &v["data"];
    let aid = v.get("agentId").and_then(Value::as_str);
    match s(v, "type") {
        "session.start" => {
            out.identify(s(d, "sessionId"));
            out.cwd = s(&d["context"], "cwd").into();
        }
        "session.context_changed" => {
            if !s(d, "cwd").is_empty() {
                out.cwd = s(d, "cwd").into();
            } else if !s(&d["context"], "cwd").is_empty() {
                out.cwd = s(&d["context"], "cwd").into();
            }
        }
        "session.title_changed" => out.title = clean(s(d, "title"), 80),
        "user.message" | "assistant.turn_start" => out.record(
            aid,
            Status::Working,
            "Planning the next move".into(),
            "thinking",
            at,
        ),
        "tool.execution_start" => tool(out, s(d, "toolName"), &d["arguments"], aid, at),
        "tool.execution_complete" => out.record(
            aid,
            if d["success"] == false {
                Status::Error
            } else {
                Status::Working
            },
            if d["success"] == false {
                "A tool reported an error"
            } else {
                "Tool finished · planning next step"
            }
            .into(),
            if d["success"] == false {
                "error"
            } else {
                "thinking"
            },
            at,
        ),
        "assistant.turn_end" | "session.idle" | "session.task_complete" => out.record(
            aid,
            Status::Idle,
            "Turn finished · resting by the fire".into(),
            "idle",
            at,
        ),
        "session.shutdown" => out.record(
            None,
            Status::Complete,
            "Settlement at rest · session closed".into(),
            "complete",
            at,
        ),
        "permission.requested" => out.record(
            aid,
            Status::Waiting,
            "Awaiting your guidance".into(),
            "waiting",
            at,
        ),
        "permission.completed" => out.record(
            aid,
            Status::Working,
            "Guidance received · returning to work".into(),
            "thinking",
            at,
        ),
        "session.error" => out.record(
            aid,
            Status::Error,
            "The agent reported an error".into(),
            "error",
            at,
        ),
        "abort" => out.record(aid, Status::Idle, "Turn interrupted".into(), "idle", at),
        "subagent.started" | "subagent.completed" => {
            let id = aid.unwrap_or_else(|| s(d, "toolCallId"));
            if id.is_empty() {
                return;
            }
            let complete = s(v, "type") == "subagent.completed";
            out.record(
                Some(id),
                if complete {
                    Status::Complete
                } else {
                    Status::Working
                },
                if complete {
                    "Assignment complete"
                } else {
                    "Joining the settlement"
                }
                .into(),
                "delegating",
                at,
            );
            if let Some(a) = out.agents.iter_mut().find(|a| a.id == id) {
                let name = if s(d, "agentDisplayName").is_empty() {
                    s(d, "agentName")
                } else {
                    s(d, "agentDisplayName")
                };
                if !name.is_empty() {
                    a.name = clean(name, 60);
                }
                if let Some(parent) = d.get("parentAgentId").and_then(Value::as_str) {
                    a.parent_id = Some(parent.into());
                }
            }
        }
        _ => {}
    }
}
fn omp(out: &mut Session, v: &Value, at: i64) {
    match s(v, "type") {
        "session" => {
            out.identify(s(v, "id"));
            out.cwd = s(v, "cwd").into();
        }
        "title" | "title_change" => {
            if !s(v, "title").is_empty() {
                out.title = clean(s(v, "title"), 80);
            }
        }
        "custom" if s(v, "customType") == "tool_execution_start" => {
            tool(out, s(&v["data"], "toolName"), &v["data"]["args"], None, at)
        }
        "custom" if s(v, "customType") == "session_exit" => out.record(
            None,
            Status::Complete,
            "Settlement at rest · session closed".into(),
            "complete",
            at,
        ),
        "message" => {
            let m = &v["message"];
            match s(m, "role") {
                "user" => out.record(
                    None,
                    Status::Working,
                    "Planning the next move".into(),
                    "thinking",
                    at,
                ),
                "assistant" => {
                    let mut has_tool = false;
                    if let Some(blocks) = m["content"].as_array() {
                        for b in blocks {
                            if s(b, "type") == "toolCall" {
                                tool(out, s(b, "name"), &b["arguments"], None, at);
                                has_tool = true;
                            }
                        }
                    }
                    if !has_tool {
                        out.record(
                            None,
                            if s(m, "stopReason") == "error" {
                                Status::Error
                            } else {
                                Status::Idle
                            },
                            "Turn finished · resting by the fire".into(),
                            "idle",
                            at,
                        );
                    }
                }
                "toolResult" => out.record(
                    None,
                    if m["isError"] == true {
                        Status::Error
                    } else {
                        Status::Working
                    },
                    if m["isError"] == true {
                        "A tool reported an error"
                    } else {
                        "Tool finished · planning next step"
                    }
                    .into(),
                    "thinking",
                    at,
                ),
                _ => {}
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn event(out: &mut Session, mut v: Value) {
        v["timestamp"] = json!("2026-10-21T15:00:00Z");
        ingest(out, &v);
    }
    #[test]
    fn copilot_tracks_real_workers_and_completion() {
        let mut out = Session::new(Harness::Copilot, "events.jsonl");
        event(
            &mut out,
            json!({"type":"session.start","data":{"sessionId":"s1","context":{"cwd":"/repo"}}}),
        );
        event(&mut out, json!({"type":"assistant.turn_start","data":{}}));
        event(
            &mut out,
            json!({"type":"subagent.started","agentId":"worker1","data":{"agentDisplayName":"Scout"}}),
        );
        event(
            &mut out,
            json!({"type":"tool.execution_start","agentId":"worker1","data":{"toolName":"edit","arguments":{"path":"src/app.ts"}}}),
        );
        assert_eq!(out.agents.len(), 2);
        assert_eq!(out.agents[1].parent_id.as_deref(), Some("root"));
        assert!(out.files.contains_key("src/app.ts"));
        event(
            &mut out,
            json!({"type":"subagent.completed","agentId":"worker1","data":{}}),
        );
        assert_eq!(out.agents[1].status, Status::Complete);
        assert_eq!(out.status, Status::Working);
    }
    #[test]
    fn codex_ignores_desktop_and_resolves_spawn_parent() {
        let mut out = Session::new(Harness::Codex, "rollout.jsonl");
        event(
            &mut out,
            json!({"type":"session_meta","payload":{"id":"s1","cwd":"/repo","source":"vscode"}}),
        );
        assert!(out.excluded);
        event(
            &mut out,
            json!({"type":"session_meta","payload":{"id":"s2","cwd":"/repo","source":{"subagent":{"thread_spawn":{"parent_thread_id":"s1"}}}}}),
        );
        assert_eq!(out.parent_session.as_deref(), Some("s1"));
        assert!(!out.excluded);
    }
    #[test]
    fn claude_subagent_is_not_a_second_settlement() {
        let mut out = Session::new(
            Harness::Claude,
            "/projects/repo/s1/subagents/agent-abc.jsonl",
        );
        event(
            &mut out,
            json!({"type":"assistant","sessionId":"s1","cwd":"/repo","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"README.md"}}]}}),
        );
        assert_eq!(out.parent_session.as_deref(), Some("s1"));
        assert_eq!(out.raw_id, "s1:agent-abc");
        assert!(out.activity.contains("Gathering"));
    }
    #[test]
    fn omp_branch_parent_is_not_an_agent_parent() {
        let mut out = Session::new(Harness::Omp, "session.jsonl");
        event(
            &mut out,
            json!({"type":"session","id":"s1","cwd":"/repo","parentSession":"forked-session"}),
        );
        event(
            &mut out,
            json!({"type":"custom","customType":"tool_execution_start","data":{"toolName":"bash","args":{"command":"npm test"}}}),
        );
        assert!(out.parent_session.is_none());
        assert!(out.activity.contains("defenses"));
        event(
            &mut out,
            json!({"type":"custom","customType":"session_exit"}),
        );
        assert_eq!(out.status, Status::Complete);
    }
    #[test]
    fn never_copies_prompts_arguments_or_outputs_to_ui() {
        let mut out = Session::new(Harness::Copilot, "events.jsonl");
        event(
            &mut out,
            json!({"type":"user.message","data":{"content":"secret-token-123"}}),
        );
        event(
            &mut out,
            json!({"type":"tool.execution_start","data":{"toolName":"bash","arguments":{"command":"echo secret-token-123"}}}),
        );
        assert!(!serde_json::to_string(&out)
            .unwrap()
            .contains("secret-token"));
    }
}
