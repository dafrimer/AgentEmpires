# Launch verification

Both macOS and Windows are launch requirements. Passing a cross-platform compile alone is not a completed launch.

## Automated gates

- [ ] Frontend build, layout/unit tests, and Playwright interaction checks pass.
- [ ] Rust adapter and monitor tests pass on Apple Silicon macOS, Intel macOS, and Windows x64.
- [ ] Tauri packages produce both macOS disk images and a Windows NSIS installer.
- [ ] Dependency audit has no known production vulnerabilities.

## Native acceptance on each OS

- [ ] Install and launch with the documented OS prerequisites.
- [ ] Open each of the four CLI harnesses and verify actual session discovery, activity, and subagent display against its journal.
- [ ] Confirm compact-window transparency, dragging, always-on-top behavior, double-click expansion, tray restore, close-to-companion, and Quit.
- [ ] Verify permission-denied roots, absent directories, non-ASCII/space-containing paths, sleep/wake, truncated logs, and clean exit.
- [ ] Reveal a known journal in Finder/Explorer. Verify copied resume commands manually after the source session ends.
- [ ] Observe a quiet desktop with multiple sessions and check that CPU/battery use is acceptable; check animation pause and reduced motion.
- [ ] Test multiple monitors and display scaling. Confirm the companion stays reachable after a monitor is disconnected.

## Distribution

- [ ] Sign and notarize macOS builds with an authorized Developer ID.
- [ ] Sign Windows installers with an authorized signing identity.
- [ ] Publish a versioned GitHub release only after all native checks are recorded.

CI workflow artifacts are development builds until these checks are complete. No signing keys or credentials belong in this repository.
