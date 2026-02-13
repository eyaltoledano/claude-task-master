---
"task-master-ai": major
---

Agent teams — execute entire tags without babysitting

Each tag (a parsed PRD's task list) can now be executed end-to-end by an AI agent team. `tm clusters start` builds an execution plan from the tag's dependency graph and launches a Claude Code teams session — sub-agents work through task clusters in parallel, level by level, while you make your coffee.

**`tm clusters start [--tag <tag>]`** — execute a tag's task graph autonomously via Claude Code agent teams

- **Checkpoint & resume** — interrupted sessions save automatically; pick up where you left off with `--resume`
- **Dry run** — preview the full execution plan before committing with `--dry-run`
- **Parallel tuning** — control concurrency with `--parallel <n>` (default: 5 tasks per level)

For the best experience, open iTerm2, run `tmux -CC` (control mode), then `tm clusters start`. This gives agent teams native pane management for parallel execution.
