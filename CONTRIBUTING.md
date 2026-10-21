# Contributing

Use Node 24 and stable Rust. Run the build, TypeScript tests, browser interaction tests, and Rust tests before opening a pull request. Keep dependency lockfiles committed.

Adapter changes should include synthetic fixtures covering the actual event shape. Never commit real session journals, prompts, credentials, machine-specific paths, or personal project data. Unknown harness fields must not break the monitor.

Keep observe-only behavior: no prompts, approvals, process termination, or harness configuration writes. Do not convert transcript parent pointers into agent relationships. Report missing evidence explicitly.

Visual changes should include a screenshot using the labeled demo world. Preserve keyboard access and reduced-motion behavior. Artwork must be original or have a compatible documented license.
