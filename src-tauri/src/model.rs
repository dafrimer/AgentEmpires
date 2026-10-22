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
#[derive(Debug, Clone)]
pub struct PendingTool {
    pub at: i64,
    pub status: Status,
    pub activity: String,
    pub kind: String,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub raw_id: String,
    pub harness: Harness,
    pub client: Option<String>,
    pub title: String,
    pub task: Option<String>,
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
    pub pending_tools: BTreeMap<String, PendingTool>,
    #[serde(skip)]
    pub parent_session: Option<String>,
    #[serde(skip)]
    pub excluded: bool,
    #[serde(skip)]
    title_is_set: bool,
}
impl Session {
    pub fn new(harness: Harness, path: &str) -> Self {
        Self {
            id: format!("{}:{}", harness.key(), path),
            raw_id: String::new(),
            harness,
            client: None,
            title: format!("{} settlement", harness.label()),
            task: None,
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
            pending_tools: BTreeMap::new(),
            parent_session: None,
            excluded: false,
            title_is_set: false,
        }
    }
    pub fn identify(&mut self, id: &str) {
        if !id.is_empty() {
            self.raw_id = id.into();
            self.id = format!("{}:{}", self.harness.key(), id);
        }
    }
    pub fn set_title(&mut self, text: &str) {
        let title: String = text
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(80)
            .collect();
        if !title.is_empty() {
            self.title = title;
            self.title_is_set = true;
        }
    }
    pub fn observe_user_text(&mut self, text: &str) {
        if let Some(task) = short_task(text, 96) {
            if !self.title_is_set {
                self.title = short_task(&task, 80).unwrap_or_else(|| task.clone());
                self.title_is_set = true;
            }
            self.task = Some(task);
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

// User-authored requests become short local labels. A short request can fit in full.
fn short_task(input: &str, limit: usize) -> Option<String> {
    let request = input.rsplit("## My request:").next().unwrap_or(input);
    for line in request.lines().take(80) {
        let line = line.trim().trim_start_matches(['-', '*', '#', ' ']).trim();
        if line.is_empty()
            || line.starts_with('<')
            || line.starts_with('`')
            || line.starts_with('{')
        {
            continue;
        }
        let lower = line.to_ascii_lowercase();
        if [
            "password",
            "secret",
            "api_key",
            "apikey",
            "token=",
            "bearer ",
            "private key",
            "http://",
            "https://",
        ]
        .iter()
        .any(|s| lower.contains(s))
            || line.split_whitespace().any(|w| w.len() > 80)
        {
            continue;
        }
        let line = line
            .trim_start_matches("Can you ")
            .trim_start_matches("Please ")
            .trim_start_matches("please ")
            .trim_start_matches("Let's ")
            .trim_start_matches("lets ");
        let sentence = line.split(['\n', '\r']).next().unwrap_or(line);
        let collapsed = sentence.split_whitespace().collect::<Vec<_>>().join(" ");
        let mut result: String = collapsed.chars().take(limit).collect();
        if collapsed.chars().count() > limit {
            if let Some(end) = result.rfind(' ') {
                result.truncate(end);
            }
            result.push('…');
        }
        let result = result
            .trim_end_matches(['.', '!', '?', ',', ':', ';', ' '])
            .trim();
        if result.chars().count() >= 5 && result.chars().any(char::is_alphabetic) {
            return Some(result.into());
        }
    }
    None
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
