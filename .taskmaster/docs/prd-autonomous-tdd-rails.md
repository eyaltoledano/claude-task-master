# PRD: Autonomous TDD + Git Workflow (On Rails)

## Summary
- Put the existing git and test workflows on rails: a repeatable, automated process that can run autonomously, with guardrails and a compact TUI for visibility.
- Flow: for a selected task, create a branch named with the tag + task id → generate tests for the first subtask (red) using the Surgical Test Generator → implement code (green) → verify tests → commit → repeat per subtask → final verify → push → open PR against the default branch.
- Build on existing rules: `.cursor/rules/git_workflow.mdc`, `.cursor/rules/test_workflow.mdc`, `.claude/agents/surgical-test-generator.md`, and existing CLI/core services.

## Goals
- Deterministic, resumable automation to execute the TDD loop per subtask with minimal human intervention.
- Strong guardrails: never commit to the default branch; only commit when tests pass; enforce status transitions; persist logs/state for debuggability.
- Visibility: a compact terminal UI (like lazygit) to pick tag, view tasks, and start work; right-side pane opens an executor terminal (via tmux) for agent coding.
- Extensible: framework-agnostic test generation via the Surgical Test Generator; detect and use the repo’s test command for execution with coverage thresholds.

## Non‑Goals (initial)
- Full multi-language runner parity beyond detection and executing the project’s test command.
- Complex GUI; start with CLI/TUI + tmux pane. IDE/extension can hook into the same state later.
- Rich executor selection UX (codex/gemini/claude) — we’ll prompt per run; defaults can come later.

## Success Criteria
- One command can autonomously complete a task’s subtasks via TDD and open a PR when done.
- All commits made on a branch that includes the tag and task id (see Branch Naming); no commits to the default branch directly.
- Every subtask iteration: failing tests added first (red), then code added to pass them (green), commit only after green.
- End-to-end logs + artifacts stored in `.taskmaster/reports/runs/<timestamp-or-id>/`.

## User Stories
- As a developer, I can run `tm autopilot <taskId>` and watch a structured, safe workflow execute.
- As a reviewer, I can inspect commits per subtask, and a PR summarizing the work when the task completes.
- As an operator, I can see current step, active subtask, tests status, and logs in a compact CLI view and read a final run report.

## High‑Level Workflow
1) Pre‑flight
   - Verify clean working tree or confirm staging/commit policy (configurable).
   - Detect repo type and the project’s test command (e.g., `npm test`, `pnpm test`, `pytest`, `go test`).
   - Validate tools: `git`, `gh` (optional for PR), `node/npm`, and (if used) `claude` CLI.
   - Load TaskMaster state and selected task; if no subtasks exist, automatically run “expand” before working.

2) Branch & Tag Setup
   - Checkout default branch and update (optional), then create a branch using Branch Naming (below).
   - Map branch ↔ tag via existing tag management; explicitly set active tag to the branch’s tag.

3) Subtask Loop (for each pending/in-progress subtask in dependency order)
   - Select next eligible subtask using `tm-core` TaskService `getNextTask()` and subtask eligibility logic.
   - Red: generate or update failing tests for the subtask
     - Use the Surgical Test Generator system prompt (`.claude/agents/surgical-test-generator.md`) to produce high-signal tests following project conventions.
     - Run tests to confirm red; record results. If not red (already passing), skip to next subtask or escalate.
   - Green: implement code to pass tests
     - Use executor to implement changes (initial: `claude` CLI prompt with focused context).
     - Re-run tests until green or timeout/backoff policy triggers.
   - Commit: when green
     - Commit tests + code with conventional commit message. Optionally update subtask status to `done`.
     - Persist run step metadata/logs.

4) Finalization
   - Run full test suite and coverage (if configured); optionally lint/format.
   - Commit any final adjustments.
   - Push branch (ask user to confirm); create PR (via `gh pr create`) targeting the default branch. Title format: `Task #<id> [<tag>]: <title>`.

5) Post‑Run
   - Update task status if desired (e.g., `review`).
   - Persist run report (JSON + markdown summary) to `.taskmaster/reports/runs/<run-id>/`.

## Guardrails
- Never commit to the default branch.
- Commit only if all tests (targeted and suite) pass; allow override flags.
- Enforce 80% coverage thresholds (lines/branches/functions/statements) by default; configurable.
- Timebox/model ops and retries; if not green within N attempts, pause with actionable state for resume.
- Always log actions, commands, and outcomes; include dry-run mode.
- Ask before branch creation, pushing, and opening a PR unless `--no-confirm` is set.

## Integration Points (Current Repo)
- CLI: `apps/cli` provides command structure and UI components.
  - New command: `tm autopilot` (alias: `task-master autopilot`).
  - Reuse UI components under `apps/cli/src/ui/components/` for headers/task details/next-task.
- Core services: `packages/tm-core`
  - `TaskService` for selection, status, tags.
  - `TaskExecutionService` for prompt formatting and executor prep.
  - Executors: `claude` executor and `ExecutorFactory` to run external tools.
  - Proposed new: `WorkflowOrchestrator` to drive the autonomous loop and emit progress events.
- Tag/Git utilities: `scripts/modules/utils/git-utils.js` and `scripts/modules/task-manager/tag-management.js` for branch→tag mapping and explicit tag switching.
- Rules: `.cursor/rules/git_workflow.mdc` and `.cursor/rules/test_workflow.mdc` to steer behavior and ensure consistency.
- Test generation prompt: `.claude/agents/surgical-test-generator.md`.

## Proposed Components
- Orchestrator (tm-core): `WorkflowOrchestrator` (new)
  - State machine driving phases: Preflight → Branch/Tag → SubtaskIter (Red/Green/Commit) → Finalize → PR.
  - Exposes an evented API (progress events) that the CLI can render.
  - Stores run state artifacts.

- Test Runner Adapter
  - Detects and runs tests via the project’s test command (e.g., `npm test`), with targeted runs where feasible.
  - API: runTargeted(files/pattern), runAll(), report summary (failures, duration, coverage), enforce 80% threshold by default.

- Git/PR Adapter
  - Encapsulates `git` ops: branch create/checkout, add/commit, push.
  - Optional `gh` integration to open PR; fallback to instructions if `gh` unavailable.
  - Confirmation gates for branch creation and pushes.
  - Adds commit footers and a unified trailer (`Refs: TM-<tag>-<id>[.<sub>]`) for robust mapping to tasks/subtasks.

- Prompt/Exec Adapter
  - Uses existing executor service to call the selected coding assistant (initially `claude`) with tight prompts: task/subtask context, surgical tests first, then minimal code to green.

- Run State + Reporting
  - JSONL log of steps, timestamps, commands, test results.
  - Markdown summary for PR description and post-run artifact.

## CLI UX (MVP)
- Command: `tm autopilot [taskId]`
  - Flags: `--dry-run`, `--no-push`, `--no-pr`, `--no-confirm`, `--force`, `--max-attempts <n>`, `--runner <auto|custom>`, `--commit-scope <scope>`
  - Output: compact header (project, tag, branch), current phase, subtask line, last test summary, next actions.
- Resume: If interrupted, `tm autopilot --resume` picks up from last checkpoint in run state.

### TUI with tmux (Linear Execution)
- Left pane: Tag selector, task list (status/priority), start/expand shortcuts; “Start” triggers the next task or a selected task.
- Right pane: Executor terminal (tmux split) that runs the coding agent (claude-code/codex). Autopilot can hand over to the right pane during green.
- MCP integration: use MCP tools for task queries/updates and for shell/test invocations where available.

## Prompts (Initial Direction)
- Red phase prompt skeleton (tests):
  - Use `.claude/agents/surgical-test-generator.md` as the system prompt to generate high-signal failing tests tailored to the project’s language and conventions. Keep scope minimal and deterministic; no code changes yet.
- Green phase prompt skeleton (code):
  - “Make the tests pass by changing the smallest amount of code, following project patterns. Only modify necessary files. Keep commits focused to this subtask.”

## Configuration
- `.taskmaster/config.json` additions
  - `autopilot`: `{ enabled: true, requireCleanWorkingTree: true, commitTemplate: "{type}({scope}): {msg}", defaultCommitType: "feat" }`
  - `test`: `{ runner: "auto", coverageThresholds: { lines: 80, branches: 80, functions: 80, statements: 80 } }`
  - `git`: `{ branchPattern: "{tag}/task-{id}-{slug}", pr: { enabled: true, base: "default" }, commitFooters: { task: "Task-Id", subtask: "Subtask-Id", tag: "Tag" }, commitTrailer: "Refs: TM-{tag}-{id}{.sub?}" }`

## Decisions
- Use conventional commits plus footers and a unified trailer `Refs: TM-<tag>-<id>[.<sub>]` for all commits; Git/PR adapter is responsible for injecting these.

## Risks and Mitigations
- Model hallucination/large diffs: restrict prompt scope; enforce minimal changes; show diff previews (optional) before commit.
- Flaky tests: allow retries, isolate targeted runs for speed, then full suite before commit.
- Environment variability: detect runners/tools; provide fallbacks and actionable errors.
- PR creation fails: still push and print manual commands; persist PR body to reuse.

## Open Questions
1) Slugging rules for branch names; any length limits or normalization beyond `{slug}` token sanitize?
2) PR body standard sections beyond run report (e.g., checklist, coverage table)?
3) Default executor prompt fine-tuning once codex/gemini integration is available.
4) Where to store persistent TUI state (pane layout, last selection) in `.taskmaster/state.json`?

## Branch Naming
- Include both the tag and the task id in the branch name to make lineage explicit.
- Default pattern: `<tag>/task-<id>[-slug]` (e.g., `master/task-12`, `tag-analytics/task-4-user-auth`).
- Configurable via `.taskmaster/config.json`: `git.branchPattern` supports tokens `{tag}`, `{id}`, `{slug}`.

## PR Base Branch
- Use the repository’s default branch (detected via git) unless overridden.
- Title format: `Task #<id> [<tag>]: <title>`.

## RPG Mapping (Repository Planning Graph)

Functional nodes (capabilities):
- Autopilot Orchestration → drives TDD loop and lifecycle
- Test Generation (Surgical) → produces failing tests from subtask context
- Test Execution + Coverage → runs suite, enforces thresholds
- Git/Branch/PR Management → safe operations and PR creation
- TUI/Terminal Integration → interactive control and visibility via tmux
- MCP Integration → structured task/status/context operations

Structural nodes (code organization):
- `packages/tm-core`:
  - `services/workflow-orchestrator.ts` (new)
  - `services/test-runner-adapter.ts` (new)
  - `services/git-adapter.ts` (new)
  - existing: `task-service.ts`, `task-execution-service.ts`, `executors/*`
- `apps/cli`:
  - `src/commands/autopilot.command.ts` (new)
  - `src/ui/tui/` (new tmux/TUI helpers)
- `scripts/modules`:
  - reuse `utils/git-utils.js`, `task-manager/tag-management.js`
- `.claude/agents/`:
  - `surgical-test-generator.md`

Edges (data/control flow):
- Autopilot → Test Generation → Test Execution → Git Commit → loop
- Autopilot → Git Adapter (branch, tag, PR)
- Autopilot → TUI (event stream) → tmux pane control
- Autopilot → MCP tools for task/status updates
- Test Execution → Coverage gate → Autopilot decision

Topological traversal (implementation order):
1) Git/Test adapters (foundations)
2) Orchestrator skeleton + events
3) CLI `autopilot` command and dry-run
4) Surgical test-gen integration and execution gate
5) PR creation, run reports, resumability

## Phased Roadmap
- Phase 0: Spike
  - Implement CLI skeleton `tm autopilot` with dry-run showing planned steps from a real task + subtasks.
  - Detect test runner (package.json) and git state; render a preflight report.

- Phase 1: Core Rails
  - Implement `WorkflowOrchestrator` in `tm-core` with event stream; add Git/Test adapters.
  - Support subtask loop (red/green/commit) with framework-agnostic test generation and detected test command; commit gating on passing tests and coverage.
  - Branch/tag mapping via existing tag-management APIs.
  - Run report persisted under `.taskmaster/reports/runs/`.

- Phase 2: PR + Resumability
  - Add `gh` PR creation with well-formed body using the run report.
  - Introduce resumable checkpoints and `--resume` flag.
  - Add coverage enforcement and optional lint/format step.

- Phase 3: Extensibility + Guardrails
  - Add support for basic pytest/go test adapters.
  - Add safeguards: diff preview mode, manual confirm gates, aggressive minimal-change prompts.
  - Optional: small TUI panel and extension panel leveraging the same run state file.

## References (Repo)
- Test Workflow: `.cursor/rules/test_workflow.mdc`
- Git Workflow: `.cursor/rules/git_workflow.mdc`
- CLI: `apps/cli/src/commands/start.command.ts`, `apps/cli/src/ui/components/*.ts`
- Core Services: `packages/tm-core/src/services/task-service.ts`, `task-execution-service.ts`
- Executors: `packages/tm-core/src/executors/*`
- Git Utilities: `scripts/modules/utils/git-utils.js`
- Tag Management: `scripts/modules/task-manager/tag-management.js`
 - Surgical Test Generator: `.claude/agents/surgical-test-generator.md`
