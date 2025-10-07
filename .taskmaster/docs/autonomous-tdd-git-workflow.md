## Summary

- Put the existing git and test workflows on rails: a repeatable, automated process that can run autonomously, with guardrails and a compact TUI for visibility.

- Flow: for a selected task, create a branch named with the tag + task id → generate tests for the first subtask (red) using the Surgical Test Generator → implement code (green) → verify tests → commit → repeat per subtask → final verify → push → open PR against the default branch.

- Build on existing rules: .cursor/rules/git_workflow.mdc, .cursor/rules/test_workflow.mdc, .claude/agents/surgical-test-generator.md, and existing CLI/core services.

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

- One command can autonomously complete a task's subtasks via TDD and open a PR when done.

- All commits made on a branch that includes the tag and task id (see Branch Naming); no commits to the default branch directly.

- Every subtask iteration: failing tests added first (red), then code added to pass them (green), commit only after green.

- End-to-end logs + artifacts stored in .taskmaster/reports/runs/<timestamp-or-id>/.

## Success Metrics (Phase 1)

- **Adoption**: 80% of tasks in a pilot repo completed via `tm autopilot`
- **Safety**: 0 commits to default branch; 100% of commits have green tests
- **Efficiency**: Average time from task start to PR < 30min for simple subtasks
- **Reliability**: < 5% of runs require manual intervention (timeout/conflicts)

## User Stories

- As a developer, I can run tm autopilot <taskId> and watch a structured, safe workflow execute.

- As a reviewer, I can inspect commits per subtask, and a PR summarizing the work when the task completes.

- As an operator, I can see current step, active subtask, tests status, and logs in a compact CLI view and read a final run report.

## Example Workflow Traces

### Happy Path: Complete a 3-subtask feature

```bash
# Developer starts
$ tm autopilot 42
→ Checks preflight: ✓ clean tree, ✓ npm test detected
→ Creates branch: analytics/task-42-user-metrics
→ Subtask 42.1: "Add metrics schema"
  RED: generates test_metrics_schema.test.js → 3 failures
  GREEN: implements schema.js → all pass
  COMMIT: "feat(metrics): add metrics schema (task 42.1)"
→ Subtask 42.2: "Add collection endpoint"
  RED: generates test_metrics_endpoint.test.js → 5 failures
  GREEN: implements api/metrics.js → all pass
  COMMIT: "feat(metrics): add collection endpoint (task 42.2)"
→ Subtask 42.3: "Add dashboard widget"
  RED: generates test_metrics_widget.test.js → 4 failures
  GREEN: implements components/MetricsWidget.jsx → all pass
  COMMIT: "feat(metrics): add dashboard widget (task 42.3)"
→ Final: all 3 subtasks complete
  ✓ Run full test suite → all pass
  ✓ Coverage check → 85% (meets 80% threshold)
  PUSH: confirms with user → pushed to origin
  PR: opens #123 "Task #42 [analytics]: User metrics tracking"

✓ Task 42 complete. PR: https://github.com/org/repo/pull/123
  Run report: .taskmaster/reports/runs/2025-01-15-142033/
```

### Error Recovery: Failing tests timeout

```bash
$ tm autopilot 42
→ Subtask 42.2 GREEN phase: attempt 1 fails (2 tests still red)
→ Subtask 42.2 GREEN phase: attempt 2 fails (1 test still red)
→ Subtask 42.2 GREEN phase: attempt 3 fails (1 test still red)

⚠️  Paused: Could not achieve green state after 3 attempts
📋 State saved to: .taskmaster/reports/runs/2025-01-15-142033/
    Last error: "POST /api/metrics returns 500 instead of 201"

Next steps:
  - Review diff: git diff HEAD
  - Inspect logs: cat .taskmaster/reports/runs/2025-01-15-142033/log.jsonl
  - Check test output: cat .taskmaster/reports/runs/2025-01-15-142033/test-results/subtask-42.2-green-attempt3.json
  - Resume after manual fix: tm autopilot --resume

# Developer manually fixes the issue, then:
$ tm autopilot --resume
→ Resuming subtask 42.2 GREEN phase
  GREEN: all tests pass
  COMMIT: "feat(metrics): add collection endpoint (task 42.2)"
→ Continuing to subtask 42.3...
```

### Dry Run: Preview before execution

```bash
$ tm autopilot 42 --dry-run
Autopilot Plan for Task #42 [analytics]: User metrics tracking
─────────────────────────────────────────────────────────────
Preflight:
  ✓ Working tree is clean
  ✓ Test command detected: npm test
  ✓ Tools available: git, gh, node, npm
  ✓ Current branch: main (will create new branch)

Branch & Tag:
  → Create branch: analytics/task-42-user-metrics
  → Set active tag: analytics

Subtasks (3 pending):
  1. 42.1: Add metrics schema
     - RED: generate tests in src/__tests__/schema.test.js
     - GREEN: implement src/schema.js
     - COMMIT: "feat(metrics): add metrics schema (task 42.1)"

  2. 42.2: Add collection endpoint [depends on 42.1]
     - RED: generate tests in src/api/__tests__/metrics.test.js
     - GREEN: implement src/api/metrics.js
     - COMMIT: "feat(metrics): add collection endpoint (task 42.2)"

  3. 42.3: Add dashboard widget [depends on 42.2]
     - RED: generate tests in src/components/__tests__/MetricsWidget.test.jsx
     - GREEN: implement src/components/MetricsWidget.jsx
     - COMMIT: "feat(metrics): add dashboard widget (task 42.3)"

Finalization:
  → Run full test suite with coverage
  → Push branch to origin (will confirm)
  → Create PR targeting main

Run without --dry-run to execute.
```

## High‑Level Workflow

1) Pre‑flight

   - Verify clean working tree or confirm staging/commit policy (configurable).

   - Detect repo type and the project’s test command (e.g., npm test, pnpm test, pytest, go test).

   - Validate tools: git, gh (optional for PR), node/npm, and (if used) claude CLI.

   - Load TaskMaster state and selected task; if no subtasks exist, automatically run “expand” before working.

2) Branch & Tag Setup

   - Checkout default branch and update (optional), then create a branch using Branch Naming (below).

   - Map branch ↔ tag via existing tag management; explicitly set active tag to the branch’s tag.

3) Subtask Loop (for each pending/in-progress subtask in dependency order)

   - Select next eligible subtask using tm-core TaskService getNextTask() and subtask eligibility logic.

   - Red: generate or update failing tests for the subtask

     - Use the Surgical Test Generator system prompt .claude/agents/surgical-test-generator.md) to produce high-signal tests following project conventions.

     - Run tests to confirm red; record results. If not red (already passing), skip to next subtask or escalate.

   - Green: implement code to pass tests

     - Use executor to implement changes (initial: claude CLI prompt with focused context).

     - Re-run tests until green or timeout/backoff policy triggers.

   - Commit: when green

     - Commit tests + code with conventional commit message. Optionally update subtask status to done.

     - Persist run step metadata/logs.

4) Finalization

   - Run full test suite and coverage (if configured); optionally lint/format.

   - Commit any final adjustments.

   - Push branch (ask user to confirm); create PR (via gh pr create) targeting the default branch. Title format: Task #<id> [<tag>]: <title>.

5) Post‑Run

   - Update task status if desired (e.g., review).

   - Persist run report (JSON + markdown summary) to .taskmaster/reports/runs/<run-id>/.

## Guardrails

- Never commit to the default branch.

- Commit only if all tests (targeted and suite) pass; allow override flags.

- Enforce 80% coverage thresholds (lines/branches/functions/statements) by default; configurable.

- Timebox/model ops and retries; if not green within N attempts, pause with actionable state for resume.

- Always log actions, commands, and outcomes; include dry-run mode.

- Ask before branch creation, pushing, and opening a PR unless --no-confirm is set.

## Integration Points (Current Repo)

- CLI: apps/cli provides command structure and UI components.

  - New command: tm autopilot (alias: task-master autopilot).

  - Reuse UI components under apps/cli/src/ui/components/ for headers/task details/next-task.

- Core services: packages/tm-core

  - TaskService for selection, status, tags.

  - TaskExecutionService for prompt formatting and executor prep.

  - Executors: claude executor and ExecutorFactory to run external tools.

  - Proposed new: WorkflowOrchestrator to drive the autonomous loop and emit progress events.

- Tag/Git utilities: scripts/modules/utils/git-utils.js and scripts/modules/task-manager/tag-management.js for branch→tag mapping and explicit tag switching.

- Rules: .cursor/rules/git_workflow.mdc and .cursor/rules/test_workflow.mdc to steer behavior and ensure consistency.

- Test generation prompt: .claude/agents/surgical-test-generator.md.

## Proposed Components

- Orchestrator (tm-core): WorkflowOrchestrator (new)

  - State machine driving phases: Preflight → Branch/Tag → SubtaskIter (Red/Green/Commit) → Finalize → PR.

  - Exposes an evented API (progress events) that the CLI can render.

  - Stores run state artifacts.

- Test Runner Adapter

  - Detects and runs tests via the project’s test command (e.g., npm test), with targeted runs where feasible.

  - API: runTargeted(files/pattern), runAll(), report summary (failures, duration, coverage), enforce 80% threshold by default.

- Git/PR Adapter

  - Encapsulates git ops: branch create/checkout, add/commit, push.

  - Optional gh integration to open PR; fallback to instructions if gh unavailable.

  - Confirmation gates for branch creation and pushes.

- Prompt/Exec Adapter

  - Uses existing executor service to call the selected coding assistant (initially claude) with tight prompts: task/subtask context, surgical tests first, then minimal code to green.

- Run State + Reporting

  - JSONL log of steps, timestamps, commands, test results.

  - Markdown summary for PR description and post-run artifact.

## CLI UX (MVP)

- Command: tm autopilot [taskId]

  - Flags: --dry-run, --no-push, --no-pr, --no-confirm, --force, --max-attempts <n>, --runner <auto|custom>, --commit-scope <scope>

  - Output: compact header (project, tag, branch), current phase, subtask line, last test summary, next actions.

- Resume: If interrupted, tm autopilot --resume picks up from last checkpoint in run state.

### TUI with tmux (Linear Execution)

- Left pane: Tag selector, task list (status/priority), start/expand shortcuts; "Start" triggers the next task or a selected task.

- Right pane: Executor terminal (tmux split) that runs the coding agent (claude-code/codex). Autopilot can hand over to the right pane during green.

- MCP integration: use MCP tools for task queries/updates and for shell/test invocations where available.

## TUI Layout (tmux-based)

### Pane Structure

```
┌─────────────────────────────────────┬──────────────────────────────────┐
│ Task Navigator (left)               │ Executor Terminal (right)        │
│                                     │                                  │
│ Project: my-app                     │ $ tm autopilot --executor-mode   │
│ Branch: analytics/task-42           │ > Running subtask 42.2 GREEN...  │
│ Tag: analytics                      │ > Implementing endpoint...       │
│                                     │ > Tests: 3 passed, 0 failed      │
│ Tasks:                              │ > Ready to commit                │
│ → 42 [in-progress] User metrics     │                                  │
│   → 42.1 [done] Schema              │ [Live output from Claude Code]   │
│   → 42.2 [active] Endpoint ◀        │                                  │
│   → 42.3 [pending] Dashboard        │                                  │
│                                     │                                  │
│ [s] start  [p] pause  [q] quit      │                                  │
└─────────────────────────────────────┴──────────────────────────────────┘
```

### Implementation Notes

- **Left pane**: `apps/cli/src/ui/tui/navigator.ts` (new, uses `blessed` or `ink`)
- **Right pane**: spawned via `tmux split-window -h` running `tm autopilot --executor-mode`
- **Communication**: shared state file `.taskmaster/state/current-run.json` + file watching or event stream
- **Keybindings**:
  - `s` - Start selected task
  - `p` - Pause/resume current run
  - `q` - Quit (with confirmation if run active)
  - `↑/↓` - Navigate task list
  - `Enter` - Expand/collapse subtasks

## Prompt Composition (Detailed)

### System Prompt Assembly

Prompts are composed in three layers:

1. **Base rules** (loaded in order from `.cursor/rules/` and `.claude/agents/`):
   - `git_workflow.mdc` → git commit conventions, branch policy, PR guidelines
   - `test_workflow.mdc` → TDD loop requirements, coverage thresholds, test structure
   - `surgical-test-generator.md` → test generation methodology, project-specific test patterns

2. **Task context injection**:
   ```
   You are implementing:
   Task #42 [analytics]: User metrics tracking
   Subtask 42.2: Add collection endpoint

   Description:
   Implement POST /api/metrics endpoint to collect user metrics events

   Acceptance criteria:
   - POST /api/metrics accepts { userId, eventType, timestamp }
   - Validates input schema (reject missing/invalid fields)
   - Persists to database
   - Returns 201 on success with created record
   - Returns 400 on validation errors

   Dependencies:
   - Subtask 42.1 (metrics schema) is complete

   Current phase: RED (generate failing tests)
   Test command: npm test
   Test file convention: src/**/*.test.js (vitest framework detected)
   Branch: analytics/task-42-user-metrics
   Project language: JavaScript (Node.js)
   ```

3. **Phase-specific instructions**:
   - **RED phase**: "Generate minimal failing tests for this subtask. Do NOT implement any production code. Only create test files. Confirm tests fail with clear error messages indicating missing implementation."
   - **GREEN phase**: "Implement minimal code to pass the failing tests. Follow existing project patterns in `src/`. Only modify files necessary for this subtask. Keep changes focused and reviewable."

### Example Full Prompt (RED Phase)

```markdown
<SYSTEM PROMPT>
[Contents of .cursor/rules/git_workflow.mdc]
[Contents of .cursor/rules/test_workflow.mdc]
[Contents of .claude/agents/surgical-test-generator.md]

<TASK CONTEXT>
You are implementing:
Task #42.2: Add collection endpoint

Description:
Implement POST /api/metrics endpoint to collect user metrics events

Acceptance criteria:
- POST /api/metrics accepts { userId, eventType, timestamp }
- Validates input schema (reject missing/invalid fields)
- Persists to database using MetricsSchema from subtask 42.1
- Returns 201 on success with created record
- Returns 400 on validation errors with details

Dependencies: Subtask 42.1 (metrics schema) is complete

<INSTRUCTION>
Generate failing tests for this subtask. Follow project conventions:
- Test file: src/api/__tests__/metrics.test.js
- Framework: vitest (detected from package.json)
- Test cases to cover:
  * POST /api/metrics with valid payload → should return 201 (will fail: endpoint not implemented)
  * POST /api/metrics with missing userId → should return 400 (will fail: validation not implemented)
  * POST /api/metrics with invalid timestamp → should return 400 (will fail: validation not implemented)
  * POST /api/metrics should persist to database → should save record (will fail: persistence not implemented)

Do NOT implement the endpoint code yet. Only create test file(s).
Confirm tests fail with messages like "Cannot POST /api/metrics" or "endpoint not defined".

Output format:
1. File path to create: src/api/__tests__/metrics.test.js
2. Complete test code
3. Command to run: npm test src/api/__tests__/metrics.test.js
```

### Example Full Prompt (GREEN Phase)

```markdown
<SYSTEM PROMPT>
[Contents of .cursor/rules/git_workflow.mdc]
[Contents of .cursor/rules/test_workflow.mdc]

<TASK CONTEXT>
Task #42.2: Add collection endpoint
[same context as RED phase]

<CURRENT STATE>
Tests created in RED phase:
- src/api/__tests__/metrics.test.js
- 5 tests written, all failing as expected

Test output:
```
FAIL src/api/__tests__/metrics.test.js
  POST /api/metrics
    ✗ should return 201 with valid payload (endpoint not found)
    ✗ should return 400 with missing userId (endpoint not found)
    ✗ should return 400 with invalid timestamp (endpoint not found)
    ✗ should persist to database (endpoint not found)
```

<INSTRUCTION>
Implement minimal code to make all tests pass.

Guidelines:
- Create/modify file: src/api/metrics.js
- Use existing patterns from src/api/ (e.g., src/api/users.js for reference)
- Import MetricsSchema from subtask 42.1 (src/models/schema.js)
- Implement validation, persistence, and response handling
- Follow project error handling conventions
- Keep implementation focused on this subtask only

After implementation:
1. Run tests: npm test src/api/__tests__/metrics.test.js
2. Confirm all 5 tests pass
3. Report results

Output format:
1. File(s) created/modified
2. Implementation code
3. Test command and results
```

### Prompt Loading Configuration

See `.taskmaster/config.json` → `prompts` section for paths and load order.

## Configuration Schema

### .taskmaster/config.json

```json
{
  "autopilot": {
    "enabled": true,
    "requireCleanWorkingTree": true,
    "commitTemplate": "{type}({scope}): {msg}",
    "defaultCommitType": "feat",
    "maxGreenAttempts": 3,
    "testTimeout": 300000
  },
  "test": {
    "runner": "auto",
    "coverageThresholds": {
      "lines": 80,
      "branches": 80,
      "functions": 80,
      "statements": 80
    },
    "targetedRunPattern": "**/*.test.js"
  },
  "git": {
    "branchPattern": "{tag}/task-{id}-{slug}",
    "pr": {
      "enabled": true,
      "base": "default",
      "bodyTemplate": ".taskmaster/templates/pr-body.md"
    }
  },
  "prompts": {
    "rulesPath": ".cursor/rules",
    "testGeneratorPath": ".claude/agents/surgical-test-generator.md",
    "loadOrder": ["git_workflow.mdc", "test_workflow.mdc"]
  }
}
```

### Configuration Fields

#### autopilot
- `enabled` (boolean): Enable/disable autopilot functionality
- `requireCleanWorkingTree` (boolean): Require clean git state before starting
- `commitTemplate` (string): Template for commit messages (tokens: `{type}`, `{scope}`, `{msg}`)
- `defaultCommitType` (string): Default commit type (feat, fix, chore, etc.)
- `maxGreenAttempts` (number): Maximum retry attempts to achieve green tests (default: 3)
- `testTimeout` (number): Timeout in milliseconds per test run (default: 300000 = 5min)

#### test
- `runner` (string): Test runner detection mode (`"auto"` or explicit command like `"npm test"`)
- `coverageThresholds` (object): Minimum coverage percentages required
  - `lines`, `branches`, `functions`, `statements` (number): Threshold percentages (0-100)
- `targetedRunPattern` (string): Glob pattern for targeted subtask test runs

#### git
- `branchPattern` (string): Branch naming pattern (tokens: `{tag}`, `{id}`, `{slug}`)
- `pr.enabled` (boolean): Enable automatic PR creation
- `pr.base` (string): Target branch for PRs (`"default"` uses repo default, or specify like `"main"`)
- `pr.bodyTemplate` (string): Path to PR body template file (optional)

#### prompts
- `rulesPath` (string): Directory containing rule files (e.g., `.cursor/rules`)
- `testGeneratorPath` (string): Path to test generator prompt file
- `loadOrder` (array): Order to load rule files from `rulesPath`

### Environment Variables

```bash
# Required for executor
ANTHROPIC_API_KEY=sk-ant-...          # Claude API key

# Optional: for PR creation
GITHUB_TOKEN=ghp_...                  # GitHub personal access token

# Optional: for other executors (future)
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

## Run Artifacts & Observability

### Per-Run Artifact Structure

Each autopilot run creates a timestamped directory with complete traceability:

```
.taskmaster/reports/runs/2025-01-15-142033/
├── manifest.json          # run metadata (task id, start/end time, status)
├── log.jsonl              # timestamped event stream
├── commits.txt            # list of commit SHAs made during run
├── test-results/
│   ├── subtask-42.1-red.json
│   ├── subtask-42.1-green.json
│   ├── subtask-42.2-red.json
│   ├── subtask-42.2-green-attempt1.json
│   ├── subtask-42.2-green-attempt2.json
│   ├── subtask-42.2-green-attempt3.json
│   └── final-suite.json
└── pr.md                  # generated PR body
```

### manifest.json Format

```json
{
  "runId": "2025-01-15-142033",
  "taskId": "42",
  "tag": "analytics",
  "branch": "analytics/task-42-user-metrics",
  "startTime": "2025-01-15T14:20:33Z",
  "endTime": "2025-01-15T14:45:12Z",
  "status": "completed",
  "subtasksCompleted": ["42.1", "42.2", "42.3"],
  "subtasksFailed": [],
  "totalCommits": 3,
  "prUrl": "https://github.com/org/repo/pull/123",
  "finalCoverage": {
    "lines": 85.3,
    "branches": 82.1,
    "functions": 88.9,
    "statements": 85.0
  }
}
```

### log.jsonl Format

Event stream in JSON Lines format for easy parsing and debugging:

```jsonl
{"ts":"2025-01-15T14:20:33Z","phase":"preflight","status":"ok","details":{"testCmd":"npm test","gitClean":true}}
{"ts":"2025-01-15T14:20:45Z","phase":"branch","status":"ok","branch":"analytics/task-42-user-metrics"}
{"ts":"2025-01-15T14:21:00Z","phase":"red","subtask":"42.1","status":"ok","tests":{"failed":3,"passed":0}}
{"ts":"2025-01-15T14:22:15Z","phase":"green","subtask":"42.1","status":"ok","tests":{"passed":3,"failed":0},"attempts":2}
{"ts":"2025-01-15T14:22:20Z","phase":"commit","subtask":"42.1","status":"ok","sha":"a1b2c3d","message":"feat(metrics): add metrics schema (task 42.1)"}
{"ts":"2025-01-15T14:23:00Z","phase":"red","subtask":"42.2","status":"ok","tests":{"failed":5,"passed":0}}
{"ts":"2025-01-15T14:25:30Z","phase":"green","subtask":"42.2","status":"error","tests":{"passed":3,"failed":2},"attempts":3,"error":"Max attempts reached"}
{"ts":"2025-01-15T14:25:35Z","phase":"pause","reason":"max_attempts","nextAction":"manual_review"}
```

### Test Results Format

Each test run stores detailed results:

```json
{
  "subtask": "42.2",
  "phase": "green",
  "attempt": 3,
  "timestamp": "2025-01-15T14:25:30Z",
  "command": "npm test src/api/__tests__/metrics.test.js",
  "exitCode": 1,
  "duration": 2340,
  "summary": {
    "total": 5,
    "passed": 3,
    "failed": 2,
    "skipped": 0
  },
  "failures": [
    {
      "test": "POST /api/metrics should return 201 with valid payload",
      "error": "Expected status 201, got 500",
      "stack": "..."
    }
  ],
  "coverage": {
    "lines": 78.5,
    "branches": 75.0,
    "functions": 80.0,
    "statements": 78.5
  }
}
```

## Execution Model

### Orchestration vs Direct Execution

The autopilot system uses an **orchestration model** rather than direct code execution:

**Orchestrator Role** (tm-core WorkflowOrchestrator):
- Maintains state machine tracking current phase (RED/GREEN/COMMIT) per subtask
- Validates preconditions (tests pass, git state clean, etc.)
- Returns "work units" describing what needs to be done next
- Records completion and advances to next phase
- Persists state for resumability

**Executor Role** (Claude Code/AI session via MCP):
- Queries orchestrator for next work unit
- Executes the work (generates tests, writes code, runs tests, makes commits)
- Reports results back to orchestrator
- Handles file operations and tool invocations

**Why This Approach?**
- Leverages existing AI capabilities (Claude Code) rather than duplicating them
- MCP protocol provides clean separation between state management and execution
- Allows human oversight and intervention at each phase
- Simpler to implement: orchestrator is pure state logic, no code generation needed
- Enables multiple executor types (Claude Code, other AI tools, human developers)

**Example Flow**:
```typescript
// Claude Code (via MCP) queries orchestrator
const workUnit = await orchestrator.getNextWorkUnit('42');
// => {
//      phase: 'RED',
//      subtask: '42.1',
//      action: 'Generate failing tests for metrics schema',
//      context: { title, description, dependencies, testFile: 'src/__tests__/schema.test.js' }
//    }

// Claude Code executes the work (writes test file, runs tests)
// Then reports back
await orchestrator.completeWorkUnit('42', '42.1', 'RED', {
  success: true,
  testsCreated: ['src/__tests__/schema.test.js'],
  testsFailed: 3
});

// Query again for next phase
const nextWorkUnit = await orchestrator.getNextWorkUnit('42');
// => { phase: 'GREEN', subtask: '42.1', action: 'Implement code to pass tests', ... }
```

## Design Decisions

### Why commit per subtask instead of per task?

**Decision**: Commit after each subtask's green state, not after the entire task.

**Rationale**:
- Atomic commits make code review easier (reviewers can see logical progression)
- Easier to revert a single subtask if it causes issues downstream
- Matches the TDD loop's natural checkpoint and cognitive boundary
- Provides resumability points if the run is interrupted

**Trade-off**: More commits per task (can use squash-merge in PRs if desired)

### Why not support parallel subtask execution?

**Decision**: Sequential subtask execution in Phase 1; parallel execution deferred to Phase 3.

**Rationale**:
- Subtasks often have implicit dependencies (e.g., schema before endpoint, endpoint before UI)
- Simpler orchestrator state machine (less complexity = faster to ship)
- Parallel execution requires explicit dependency DAG and conflict resolution
- Can be added in Phase 3 once core workflow is proven stable

**Trade-off**: Slower for truly independent subtasks (mitigated by keeping subtasks small and focused)

### Why require 80% coverage by default?

**Decision**: Enforce 80% coverage threshold (lines/branches/functions/statements) before allowing commits.

**Rationale**:
- Industry standard baseline for production code quality
- Forces test generation to be comprehensive, not superficial
- Configurable per project via `.taskmaster/config.json` if too strict
- Prevents "green tests" that only test happy paths

**Trade-off**: May require more test generation iterations; can be lowered per project

### Why use tmux instead of a rich GUI?

**Decision**: MVP uses tmux split panes for TUI, not Electron/web-based GUI.

**Rationale**:
- Tmux is universally available on dev machines; no installation burden
- Terminal-first workflows match developer mental model (no context switching)
- Simpler to implement and maintain; can add GUI later via extensions
- State stored in files allows IDE/extension integration without coupling

**Trade-off**: Less visual polish than GUI; requires tmux familiarity

### Why not support multiple executors (codex/gemini/claude) in Phase 1?

**Decision**: Start with Claude executor only; add others in Phase 2+.

**Rationale**:
- Reduces scope and complexity for initial delivery
- Claude Code already integrated with existing executor service
- Executor abstraction already exists; adding more is straightforward later
- Different executors may need different prompt strategies (requires experimentation)

**Trade-off**: Users locked to Claude initially; can work around with manual executor selection

## Risks and Mitigations

- Model hallucination/large diffs: restrict prompt scope; enforce minimal changes; show diff previews (optional) before commit.

- Flaky tests: allow retries, isolate targeted runs for speed, then full suite before commit.

- Environment variability: detect runners/tools; provide fallbacks and actionable errors.

- PR creation fails: still push and print manual commands; persist PR body to reuse.

## Open Questions

1) Slugging rules for branch names; any length limits or normalization beyond {slug} token sanitize?

2) PR body standard sections beyond run report (e.g., checklist, coverage table)?

3) Default executor prompt fine-tuning once codex/gemini integration is available.

4) Where to store persistent TUI state (pane layout, last selection) in .taskmaster/state.json?

## Branch Naming

- Include both the tag and the task id in the branch name to make lineage explicit.

- Default pattern: <tag>/task-<id>[-slug] (e.g., master/task-12, tag-analytics/task-4-user-auth).

- Configurable via .taskmaster/config.json: git.branchPattern supports tokens {tag}, {id}, {slug}.

## PR Base Branch

- Use the repository’s default branch (detected via git) unless overridden.

- Title format: Task #<id> [<tag>]: <title>.

## RPG Mapping (Repository Planning Graph)

Functional nodes (capabilities):

- Autopilot Orchestration → drives TDD loop and lifecycle

- Test Generation (Surgical) → produces failing tests from subtask context

- Test Execution + Coverage → runs suite, enforces thresholds

- Git/Branch/PR Management → safe operations and PR creation

- TUI/Terminal Integration → interactive control and visibility via tmux

- MCP Integration → structured task/status/context operations

Structural nodes (code organization):

- packages/tm-core:

  - services/workflow-orchestrator.ts (new)

  - services/test-runner-adapter.ts (new)

  - services/git-adapter.ts (new)

  - existing: task-service.ts, task-execution-service.ts, executors/*

- apps/cli:

  - src/commands/autopilot.command.ts (new)

  - src/ui/tui/ (new tmux/TUI helpers)

- scripts/modules:

  - reuse utils/git-utils.js, task-manager/tag-management.js

- .claude/agents/:

  - surgical-test-generator.md

Edges (data/control flow):

- Autopilot → Test Generation → Test Execution → Git Commit → loop

- Autopilot → Git Adapter (branch, tag, PR)

- Autopilot → TUI (event stream) → tmux pane control

- Autopilot → MCP tools for task/status updates

- Test Execution → Coverage gate → Autopilot decision

Topological traversal (implementation order):

1) Git/Test adapters (foundations)

2) Orchestrator skeleton + events

3) CLI autopilot command and dry-run

4) Surgical test-gen integration and execution gate

5) PR creation, run reports, resumability

## Phased Roadmap

- Phase 0: Spike

  - Implement CLI skeleton tm autopilot with dry-run showing planned steps from a real task + subtasks.

  - Detect test runner (package.json) and git state; render a preflight report.

- Phase 1: Core Rails (State Machine & Orchestration)

  - Implement WorkflowOrchestrator in tm-core as a **state machine** that tracks TDD phases per subtask.

  - Orchestrator **guides** the current AI session (Claude Code/MCP client) rather than executing code itself.

  - Add Git/Test adapters for status checks and validation (not direct execution).

  - WorkflowOrchestrator API:
    - `getNextWorkUnit(taskId)` → returns next phase to execute (RED/GREEN/COMMIT) with context
    - `completeWorkUnit(taskId, subtaskId, phase, result)` → records completion and advances state
    - `getRunState(taskId)` → returns current progress and resumability data

  - MCP integration: expose work unit endpoints so Claude Code can query "what to do next" and report back.

  - Branch/tag mapping via existing tag-management APIs.

  - Run report persisted under .taskmaster/reports/runs/ with state checkpoints for resumability.

- Phase 2: PR + Resumability

  - Add gh PR creation with well-formed body using the run report.

  - Introduce resumable checkpoints and --resume flag.

  - Add coverage enforcement and optional lint/format step.

- Phase 3: Extensibility + Guardrails

  - Add support for basic pytest/go test adapters.

  - Add safeguards: diff preview mode, manual confirm gates, aggressive minimal-change prompts.

  - Optional: small TUI panel and extension panel leveraging the same run state file.

## References (Repo)

- Test Workflow: .cursor/rules/test_workflow.mdc

- Git Workflow: .cursor/rules/git_workflow.mdc

- CLI: apps/cli/src/commands/start.command.ts, apps/cli/src/ui/components/*.ts

- Core Services: packages/tm-core/src/services/task-service.ts, task-execution-service.ts

- Executors: packages/tm-core/src/executors/*

- Git Utilities: scripts/modules/utils/git-utils.js

- Tag Management: scripts/modules/task-manager/tag-management.js

 - Surgical Test Generator: .claude/agents/surgical-test-generator.md

