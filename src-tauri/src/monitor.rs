use crate::{adapters, model::*};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::SystemTime,
};
use walkdir::WalkDir;

const MAX_JOURNALS: usize = 256;
const MAX_RECORD: usize = 4 * 1024 * 1024;
const READ_BUDGET: u64 = 8 * 1024 * 1024;
struct Journal {
    offset: u64,
    modified: SystemTime,
    prefix: Vec<u8>,
    pending: Vec<u8>,
    dropping: bool,
    session: Session,
    warning: Option<String>,
}
impl Journal {
    fn new(harness: Harness, path: &Path) -> Self {
        Self {
            offset: 0,
            modified: SystemTime::UNIX_EPOCH,
            prefix: vec![],
            pending: vec![],
            dropping: false,
            session: Session::new(harness, &path.to_string_lossy()),
            warning: None,
        }
    }
    fn update(&mut self, path: &Path) -> std::io::Result<bool> {
        let mut file = File::open(path)?;
        let meta = file.metadata()?;
        let modified = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        let mut prefix = vec![0; meta.len().min(512) as usize];
        file.read_exact(&mut prefix)?;
        let prefix_changed = !self.prefix.is_empty() && !prefix.starts_with(&self.prefix);
        if meta.len() < self.offset
            || prefix_changed
            || (meta.len() == self.offset && modified != self.modified)
        {
            *self = Self::new(self.session.harness, path);
        }
        self.prefix = prefix;
        self.modified = modified;
        file.seek(SeekFrom::Start(self.offset))?;
        let mut buf = Vec::new();
        file.take(READ_BUDGET).read_to_end(&mut buf)?;
        self.offset += buf.len() as u64;
        for byte in buf {
            if byte == b'\n' {
                if !self.dropping && !self.pending.is_empty() {
                    match serde_json::from_slice(&self.pending) {
                        Ok(v) => adapters::ingest(&mut self.session, &v),
                        Err(_) => self.warning = Some("Skipped a malformed journal record".into()),
                    }
                }
                self.pending.clear();
                self.dropping = false;
            } else if !self.dropping {
                if self.pending.len() >= MAX_RECORD {
                    self.pending.clear();
                    self.dropping = true;
                    self.warning = Some("Skipped a journal record larger than 4 MiB".into());
                } else {
                    self.pending.push(byte);
                }
            }
        }
        Ok(self.offset < meta.len())
    }
}

pub struct Monitor {
    journals: HashMap<PathBuf, Journal>,
    repos: HashMap<String, (String, String)>,
}
impl Default for Monitor {
    fn default() -> Self {
        Self::new()
    }
}
impl Monitor {
    pub fn new() -> Self {
        Self {
            journals: HashMap::new(),
            repos: HashMap::new(),
        }
    }
    pub fn scan(&mut self, settings: &Settings) -> Snapshot {
        let now = now();
        let cutoff = now - (settings.history_hours as i64) * 3_600_000;
        let mut snapshot = Snapshot {
            scanned_at: now,
            ..Default::default()
        };
        let mut seen = HashSet::new();
        for (&harness, root) in &settings.roots {
            let root = Path::new(root);
            let mut health = AdapterHealth {
                harness,
                root: root.to_string_lossy().into_owned(),
                available: root.is_dir(),
                journals: 0,
                warning: None,
            };
            let mut paths = vec![];
            if health.available {
                for entry in WalkDir::new(root)
                    .follow_links(false)
                    .max_depth(12)
                    .into_iter()
                    .take(50_000)
                {
                    let entry = match entry {
                        Ok(e) => e,
                        Err(_) => {
                            health.warning = Some("Some journal directories are unreadable".into());
                            continue;
                        }
                    };
                    if !entry.file_type().is_file()
                        || entry.path().extension().and_then(|s| s.to_str()) != Some("jsonl")
                    {
                        continue;
                    }
                    if harness == Harness::Copilot && entry.file_name() != "events.jsonl" {
                        continue;
                    }
                    if let Ok(meta) = entry.metadata() {
                        let ms = meta
                            .modified()
                            .ok()
                            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                            .map(|d| d.as_millis() as i64)
                            .unwrap_or(0);
                        if ms >= cutoff {
                            paths.push((ms, entry.into_path()));
                        }
                    }
                }
            }
            paths.sort_by(|a, b| b.0.cmp(&a.0));
            if paths.len() > MAX_JOURNALS {
                health.warning = Some(format!("Showing the newest {MAX_JOURNALS} journals"));
                paths.truncate(MAX_JOURNALS);
            }
            health.journals = paths.len();
            for (_, path) in paths {
                seen.insert(path.clone());
                let journal = self
                    .journals
                    .entry(path.clone())
                    .or_insert_with(|| Journal::new(harness, &path));
                match journal.update(&path) {
                    Ok(behind) => snapshot.scanning |= behind,
                    Err(_) => {
                        health.warning = Some("A journal could not be read".into());
                        continue;
                    }
                }
                if journal.warning.is_some() {
                    health.warning = journal.warning.clone();
                }
                let mut session = journal.session.clone();
                if session.raw_id.is_empty() || session.excluded {
                    continue;
                }
                if harness == Harness::Omp {
                    // OMP child journals live in the parent's companion artifact directory.
                    // parentSession in a header means a fork, not delegation.
                    if let Some(parent_dir) = path.parent() {
                        let sibling = parent_dir.with_extension("jsonl");
                        if sibling.is_file() && sibling != path {
                            session.parent_session =
                                Some(format!("@path:{}", sibling.to_string_lossy()));
                        }
                    }
                }
                let (repo_key, repo_name) = self
                    .repos
                    .entry(session.cwd.clone())
                    .or_insert_with(|| repository(&session.cwd));
                session.repo_key = repo_key.clone();
                session.repo_name = repo_name.clone();
                if session.title.ends_with(" settlement") {
                    session.title = format!("{} · {}", session.repo_name, session.harness.label());
                }
                let mut files = BTreeMap::new();
                for (file, at) in &session.files {
                    if *at >= now - 30 * 60 * 1000 {
                        files.insert(file_identity(&session.cwd, file, &session.repo_key), *at);
                    }
                }
                session.files = files;
                for agent in &mut session.agents {
                    if matches!(agent.status, Status::Working | Status::Waiting)
                        && now - agent.updated_at > 120_000
                    {
                        agent.status = Status::Stale;
                        agent.activity = "No recent journal activity".into();
                    }
                }
                if matches!(session.status, Status::Working | Status::Waiting)
                    && now - session.last_activity > 120_000
                {
                    session.status = Status::Stale;
                    session.activity = "No recent journal activity".into();
                }
                snapshot.sessions.push(session);
            }
            snapshot.adapters.push(health);
        }
        self.journals.retain(|p, _| seen.contains(p));
        merge_children(&mut snapshot.sessions);
        for session in &mut snapshot.sessions {
            // A lead agent can finish while its delegated workers continue.
            if let Some(agent) = session
                .agents
                .iter()
                .find(|a| a.status == Status::Waiting)
                .or_else(|| session.agents.iter().find(|a| a.status == Status::Working))
            {
                session.status = agent.status;
                session.activity = agent.activity.clone();
            }
        }
        snapshot
            .sessions
            .sort_by(|a, b| b.last_activity.cmp(&a.last_activity));
        snapshot
    }
}
fn merge_children(sessions: &mut Vec<Session>) {
    // Resolve chains by index before merging, so scan order cannot flatten nested workers.
    let mut parents = HashMap::new();
    for (i, s) in sessions.iter().enumerate() {
        if let Some(parent) = &s.parent_session {
            if let Some(j) = sessions.iter().position(|p| {
                p.harness == s.harness
                    && (p.raw_id == *parent || format!("@path:{}", p.source_path) == *parent)
            }) {
                if i != j {
                    parents.insert(i, j);
                }
            }
        }
    }
    let mut additions = vec![];
    let mut children = HashSet::new();
    for (&child, &direct_parent) in &parents {
        let mut root = direct_parent;
        let mut visited = HashSet::from([child]);
        while let Some(p) = parents.get(&root) {
            if !visited.insert(root) {
                break;
            }
            root = *p;
        }
        if visited.contains(&root) {
            continue;
        }
        let s = &sessions[child];
        let prefix = s.id.clone();
        let parent_id = if direct_parent == root {
            "root".into()
        } else {
            format!("{}:root", sessions[direct_parent].id)
        };
        let mut agents = s.agents.clone();
        for a in &mut agents {
            a.parent_id = Some(match &a.parent_id {
                Some(id) => format!("{prefix}:{id}"),
                None => parent_id.clone(),
            });
            a.id = format!("{prefix}:{}", a.id);
            if a.name == "Lead agent" {
                a.name = "Subagent".into();
            }
        }
        additions.push((root, agents, s.files.clone(), s.last_activity));
        children.insert(child);
    }
    for (root, agents, files, last) in additions {
        let s = &mut sessions[root];
        s.agents.extend(agents);
        s.files.extend(files);
        s.last_activity = s.last_activity.max(last);
    }
    let mut i = 0;
    sessions.retain(|s| {
        let keep = !children.contains(&i) && s.parent_session.is_none();
        i += 1;
        keep
    });
}
fn normalize_file(cwd: &str, file: &str) -> String {
    let p = Path::new(file);
    let p = if p.is_absolute() {
        p.to_path_buf()
    } else {
        Path::new(cwd).join(p)
    };
    let mut normalized = PathBuf::new();
    for c in p.components() {
        match c {
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            std::path::Component::CurDir => {}
            _ => normalized.push(c.as_os_str()),
        }
    }
    normalized.to_string_lossy().replace('\\', "/")
}
fn file_identity(cwd: &str, file: &str, repo_key: &str) -> String {
    let normalized = normalize_file(cwd, file);
    for root in Path::new(cwd).ancestors() {
        if root.join(".git").exists() {
            if let Ok(relative) = Path::new(&normalized).strip_prefix(root) {
                return format!(
                    "{}::{}",
                    repo_key,
                    relative.to_string_lossy().replace('\\', "/")
                );
            }
            break;
        }
    }
    normalized
}
fn repository(cwd: &str) -> (String, String) {
    if cwd.is_empty() {
        return ("unknown".into(), "Uncharted".into());
    }
    let path = Path::new(cwd);
    for dir in path.ancestors() {
        let git = dir.join(".git");
        if git.is_dir() {
            return (
                fs::canonicalize(&git)
                    .unwrap_or(git)
                    .to_string_lossy()
                    .into_owned(),
                dir.file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        if git.is_file() {
            if let Ok(text) = fs::read_to_string(&git) {
                if let Some(gitdir) = text.trim().strip_prefix("gitdir: ") {
                    let gitdir = dir.join(gitdir);
                    let common = fs::read_to_string(gitdir.join("commondir"))
                        .ok()
                        .map(|c| gitdir.join(c.trim()))
                        .unwrap_or(gitdir);
                    let common = fs::canonicalize(&common).unwrap_or(common);
                    let name = common
                        .parent()
                        .and_then(Path::file_name)
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned();
                    return (common.to_string_lossy().into_owned(), name);
                }
            }
        }
    }
    (
        cwd.into(),
        path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    #[test]
    fn partial_records_append_and_truncation() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("events.jsonl");
        let mut f = File::create(&path).unwrap();
        write!(
            f,
            "{{\"type\":\"session.start\",\"data\":{{\"sessionId\":\"one\"}}}}\n{{\"type\":"
        )
        .unwrap();
        let mut j = Journal::new(Harness::Copilot, &path);
        j.update(&path).unwrap();
        assert_eq!(j.session.raw_id, "one");
        write!(
            f,
            "\"assistant.turn_start\",\"timestamp\":\"2026-10-21T15:00:00Z\"}}\n"
        )
        .unwrap();
        j.update(&path).unwrap();
        assert_eq!(j.session.status, Status::Working);
        assert_eq!(j.session.event_count, 1);
        j.update(&path).unwrap();
        assert_eq!(j.session.event_count, 1);
        fs::write(
            &path,
            "{\"type\":\"session.start\",\"data\":{\"sessionId\":\"two\"}}\n",
        )
        .unwrap();
        j.update(&path).unwrap();
        assert_eq!(j.session.raw_id, "two");
        assert_eq!(j.session.event_count, 0);
    }
    #[test]
    fn malformed_records_do_not_stop_later_events() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("s.jsonl");
        fs::write(
            &p,
            "garbage\n{\"type\":\"session\",\"id\":\"valid\",\"cwd\":\"/repo\"}\n",
        )
        .unwrap();
        let mut j = Journal::new(Harness::Omp, &p);
        j.update(&p).unwrap();
        assert_eq!(j.session.raw_id, "valid");
        assert!(j.warning.is_some());
    }
    #[test]
    fn nested_workers_attach_to_correct_parents() {
        let mut a = Session::new(Harness::Codex, "a");
        a.identify("a");
        a.record(None, Status::Working, "work".into(), "working", 1);
        let mut b = a.clone();
        b.identify("b");
        b.parent_session = Some("a".into());
        let mut c = a.clone();
        c.identify("c");
        c.parent_session = Some("b".into());
        let mut sessions = vec![c, a, b];
        merge_children(&mut sessions);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].agents.len(), 3);
        assert_eq!(
            sessions[0]
                .agents
                .iter()
                .find(|a| a.id == "codex:c:root")
                .unwrap()
                .parent_id
                .as_deref(),
            Some("codex:b:root")
        );
    }
    #[test]
    fn worktrees_share_repository_identity() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = tmp.path().join("repo");
        let work = tmp.path().join("work");
        fs::create_dir_all(repo.join(".git/worktrees/work")).unwrap();
        fs::create_dir_all(&work).unwrap();
        fs::write(
            work.join(".git"),
            format!("gitdir: {}", repo.join(".git/worktrees/work").display()),
        )
        .unwrap();
        fs::write(repo.join(".git/worktrees/work/commondir"), "../..").unwrap();
        assert_eq!(
            repository(&repo.to_string_lossy()).0,
            repository(&work.to_string_lossy()).0
        );
    }
}
