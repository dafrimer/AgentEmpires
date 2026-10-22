//! Read-only diagnostic: prints counts, never transcript text or local paths.
use agent_empires::{
    model::{Harness, Settings},
    monitor::Monitor,
};
fn main() {
    let settings = Settings {
        history_hours: 168,
        ..Default::default()
    };
    let mut monitor = Monitor::new();
    let mut snapshot = monitor.scan(&settings);
    for _ in 0..30 {
        if !snapshot.scanning {
            break;
        }
        snapshot = monitor.scan(&settings);
    }
    for harness in [
        Harness::Codex,
        Harness::Claude,
        Harness::Copilot,
        Harness::Omp,
    ] {
        let sessions: Vec<_> = snapshot
            .sessions
            .iter()
            .filter(|s| s.harness == harness)
            .collect();
        let agents: usize = sessions.iter().map(|s| s.agents.len()).sum();
        let journals = snapshot
            .adapters
            .iter()
            .find(|a| a.harness == harness)
            .map(|a| a.journals)
            .unwrap_or(0);
        println!(
            "{}: {journals} recent journals, {} top-level sessions, {agents} observed agents",
            harness.label(),
            sessions.len()
        );
    }
    if snapshot.scanning {
        println!("Backlog still being read; run the desktop monitor to continue.");
    }
    if let Some(id) = std::env::args().nth(1) {
        let requested = snapshot.sessions.iter().find(|s| s.raw_id == id);
        println!(
            "Requested top-level session present: {}",
            requested.is_some()
        );
        if let Some(session) = requested {
            println!(
                "Observed agents: {} ({} linked subagents)",
                session.agents.len(),
                session
                    .agents
                    .iter()
                    .filter(|a| a.parent_id.is_some())
                    .count()
            );
        }
    }
}
