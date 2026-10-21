use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Harness {
    Codex,
    Claude,
    Copilot,
    Omp,
}
impl Harness {
    pub fn label(self) -> &'static str {
        match self {
            Self::Codex => "Codex",
            Self::Claude => "Claude Code",
            Self::Copilot => "Copilot",
            Self::Omp => "Oh My Pi",
        }
    }
    pub fn key(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
            Self::Copilot => "copilot",
            Self::Omp => "omp",
        }
    }
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Working,
    Waiting,
    Idle,
    Complete,
    Error,
    Stale,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub status: Status,
    pub activity: String,
    pub updated_at: i64,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub at: i64,
    pub agent_id: String,
    pub text: String,
    pub kind: String,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub raw_id: String,
    pub harness: Harness,
    pub title: String,
    pub cwd: String,
    pub repo_key: String,
    pub repo_name: String,
    pub source_path: String,
    pub status: Status,
    pub activity: String,
    pub last_activity: i64,
    pub event_count: u64,
    pub agents: Vec<Agent>,
    pub files: BTreeMap<String, i64>,
    pub timeline: Vec<Activity>,
    #[serde(skip)]
    pub parent_session: Option<String>,
    #[serde(skip)]
    pub excluded: bool,
}
impl Session {
    pub fn new(harness: Harness, path: &str) -> Self {
        Self {
            id: format!("{}:{}", harness.key(), path),
            raw_id: String::new(),
            harness,
            title: format!("{} settlement", harness.label()),
            cwd: String::new(),
            repo_key: String::new(),
            repo_name: "Uncharted".into(),
            source_path: path.into(),
            status: Status::Stale,
            activity: "Waiting for journal activity".into(),
            last_activity: 0,
            event_count: 0,
            agents: vec![],
            files: BTreeMap::new(),
            timeline: vec![],
            parent_session: None,
            excluded: false,
        }
    }
    pub fn identify(&mut self, id: &str) {
        if !id.is_empty() {
            self.raw_id = id.into();
            self.id = format!("{}:{}", self.harness.key(), id);
        }
    }
    pub fn record(
        &mut self,
        agent: Option<&str>,
        status: Status,
        text: String,
        kind: &str,
        at: i64,
    ) {
        if at == 0 {
            return;
        }
        let agent_id = agent.unwrap_or("root");
        if !self.agents.iter().any(|a| a.id == agent_id) && self.agents.len() < 128 {
            self.agents.push(Agent {
                id: agent_id.into(),
                parent_id: if agent_id == "root" {
                    None
                } else {
                    Some("root".into())
                },
                name: if agent_id == "root" {
                    "Lead agent".into()
                } else {
                    "Subagent".into()
                },
                status,
                activity: text.clone(),
                updated_at: at,
            });
        }
        if let Some(a) = self.agents.iter_mut().find(|a| a.id == agent_id) {
            if at >= a.updated_at {
                a.status = status;
                a.activity = text.clone();
                a.updated_at = at;
            }
        }
        if at >= self.last_activity {
            self.last_activity = at;
            if agent_id == "root" {
                self.status = status;
                self.activity = text.clone();
            }
        }
        self.event_count += 1;
        self.timeline.push(Activity {
            at,
            agent_id: agent_id.into(),
            text,
            kind: kind.into(),
        });
        if self.timeline.len() > 30 {
            self.timeline.remove(0);
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub roots: BTreeMap<Harness, String>,
    pub history_hours: u32,
}
impl Default for Settings {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_default();
        let codex = std::env::var_os("CODEX_HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or(home.join(".codex"));
        let claude = std::env::var_os("CLAUDE_CONFIG_DIR")
            .map(std::path::PathBuf::from)
            .unwrap_or(home.join(".claude"));
        Self {
            roots: [
                (Harness::Codex, codex.join("sessions")),
                (Harness::Claude, claude.join("projects")),
                (Harness::Copilot, home.join(".copilot/session-state")),
                (Harness::Omp, home.join(".omp/agent/sessions")),
            ]
            .into_iter()
            .map(|(k, v)| (k, v.to_string_lossy().into_owned()))
            .collect(),
            history_hours: 24,
        }
    }
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterHealth {
    pub harness: Harness,
    pub root: String,
    pub available: bool,
    pub journals: usize,
    pub warning: Option<String>,
}
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub sessions: Vec<Session>,
    pub adapters: Vec<AdapterHealth>,
    pub scanned_at: i64,
    pub scanning: bool,
}
pub fn now() -> i64 {
    chrono::Utc::now().timestamp_millis()
}
