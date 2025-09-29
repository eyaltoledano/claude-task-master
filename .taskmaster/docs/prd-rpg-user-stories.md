# PRD: RPG‑Based User Story Mode + Validation‑First Delivery

## Summary
- Introduce a “User Story Mode” where each Task is a user story and each Subtask is a concrete implementation step. Enable via config flag; when enabled, Task generation and PRD parsing produce user‑story titles/details with acceptance criteria, while Subtasks capture implementation details.
- Build a validation‑first delivery pipeline: derive tests from acceptance criteria (Surgical Test Generator), wire TDD rails and Git/PR mapping so reviews focus on verification rather than code spelunking.
- Keep everything on rails: branch naming with tag+task id, commit/PR linkage to tasks/subtasks, coverage + test gates, and lightweight TUI for fast execution.

## North‑Star Outcomes
- Humans stay in briefs/frontends; implementation runs quickly, often without opening the IDE.
- “Definition of Done” is expressed and enforced as tests; business logic is encoded in test criteria/acceptance criteria.
- End‑to‑end linkage from brief → user story → subtasks → commits/PRs → delivery, with reproducible automation and minimal ceremony.

## Problem
- The bottleneck is validation and PR review, not code generation. Plans are helpful but the chokepoint is proving correctness, business conformance, and integration.
- Current test workflow is too Jest‑specific; we need framework‑agnostic generation and execution.
- We need consistent Git/TDD wiring so GitHub integrations can map work artifacts to tasks/subtasks without ambiguity.

## Solution Overview
- Add a configuration flag to switch to user story mode and adapt prompts/parsers.
- Expand tasks with explicit Acceptance Criteria and Test Criteria; drive Surgical Test Generator to create failing tests first; wire autonomous TDD loops per subtask until green, then commit.
- Enforce coverage (80% default) and generate PRs that summarize user story, acceptance criteria coverage, and test results; commits/PRs contain metadata to link back to tasks/subtasks.
- Provide a compact TUI (tmux) to pick tag/tasks and launch an executor terminal, while the orchestrator runs rails in the background.

---

## Configuration
- `.taskmaster/config.json` additions
  - `stories`: `{ enabled: true, storyLabel: "User Story", acceptanceKey: "Acceptance Criteria" }`
  - `autopilot`: `{ enabled: true, requireCleanWorkingTree: true }`
  - `test`: `{ runner: "auto", coverageThresholds: { lines: 80, branches: 80, functions: 80, statements: 80 } }`
  - `git`: `{ branchPattern: "{tag}/task-{id}-{slug}", pr: { enabled: true, base: "default" }, commitFooters: { task: "Task-Id", subtask: "Subtask-Id", tag: "Tag" } }`

Behavior when `stories.enabled=true`:
- Task generation prompts and PRD parsers produce user‑story formatted titles and descriptions, include acceptance criteria blocks, and set `task.type = 'user_story'`.
- Subtasks remain implementation steps with concise technical goals.
- Expand will ensure any missing acceptance criteria is synthesized (from brief/PRD content) before starting work.

---

## Data Model Changes
- Task fields (add):
  - `type: 'user_story' | 'technical'` (default `technical`)
  - `acceptanceCriteria: string[] | string` (structured or markdown)
  - `testCriteria: string[] | string` (optional, derived from acceptance criteria; what to validate)
- Subtask fields remain focused on implementation detail and dependency graph.

Storage and UI remain backward compatible; fields are optional when `stories.enabled=false`.

### JSON Gherkin Representation (for stories)
Add an optional `gherkin` block to Tasks in story mode. Keep Hybrid acceptanceCriteria as the human/authoring surface; maintain a normalized JSON Gherkin for deterministic mapping.

```
GherkinFeature {
  id: string,                   // FEAT-<taskId>
  name: string,                 // mirrors user story title
  description?: string,
  background?: { steps: Step[] },
  scenarios: Scenario[]
}

Scenario {
  id: string,                   // SC-<taskId>-<n> or derived from AC id
  name: string,
  tags?: string[],
  steps: Step[],                // Given/When/Then/And/But
  examples?: Record<string, any>[]
}

Step { keyword: 'Given'|'When'|'Then'|'And'|'But', text: string }
```

Notes
- Derive `gherkin.scenarios` from acceptanceCriteria when obvious; preserve both raw markdown and normalized items.
- Allow cross‑references between scenarios and AC items (e.g., `refs: ['AC-12-1']`).

---

## RPG Plan (Repository Planning Graph)

Functional Nodes (Capabilities)
- Brief Intake → parse briefs/PRDs and extract user stories (when enabled)
- User Story Generation → create task title/details as user stories + acceptance criteria
- JSON Gherkin Synthesis → produce Feature/Scenario structure from acceptance criteria
- Acceptance/Test Criteria Synthesis → convert acceptance criteria into concrete test criteria
- Surgical Test Generation → generate failing tests per subtask using `.claude/agents/surgical-test-generator.md`
- Implementation Planning → expand subtasks as atomic implementation steps with dependencies
- Autonomous Execution (Rails) → branch, red/green loop per subtask, commit when green
- Validation & Review Automation → coverage gates, PR body with user story + results, checklist
- GitHub Integration Mapping → branch naming, commit footers, PR linkage to tasks/subtasks
- TUI/Terminal Integration → tag/task selection left pane; executor terminal right pane via tmux

Structural Nodes (Code Organization)
- `packages/tm-core`
  - `services/workflow-orchestrator.ts` (new): drives rails, emits progress events
  - `services/story-mode.service.ts` (new): toggles prompts/parsers for user stories, acceptance criteria
  - `services/test-runner-adapter.ts` (new): detects/executes project test command, collects coverage
  - `services/git-adapter.ts` (new): branch/commit/push, PR creation; applies commit footers
  - existing: `task-service.ts`, `task-execution-service.ts`, `executors/*`
- `apps/cli`
  - `src/commands/autopilot.command.ts` (new): orchestrates a full run; supports `--stories`
  - `src/ui/tui/` (new): tmux helpers and compact panes for selection and logs
- `scripts/modules`
  - reuse `utils/git-utils.js`, `task-manager/tag-management.js`, PR template utilities
- `.cursor/rules`
  - update generation/parsing rules to emit user‑story format when enabled
- `.claude/agents`
  - existing: `surgical-test-generator.md` for red phase

Edges (Dependencies / Data Flow)
- Brief Intake → User Story Generation → Acceptance/Test Criteria Synthesis → Implementation Planning → Autonomous Execution → Validation/PR
- Execution ↔ Test Runner (runAll/runTargeted, coverage) → back to Execution for decisions
- Git Adapter ← Execution (commits/branch) → PR creation (target default branch)
- TUI ↔ Orchestrator (event stream) → user confirmations for branch/push/PR
- MCP Tools ↔ Orchestrator for task/status/context updates

Topological Traversal (Build Order)
1) Config + Data Model changes (stories flag, acceptance fields, optional `gherkin`)
2) Rules/Prompts updates for parsing/generation in story mode (emit AC Hybrid + JSON Gherkin)
3) Test Runner Adapter (framework‑agnostic execute + coverage)
4) Git Adapter (branch pattern `{tag}/task-{id}-{slug}`, commit footers/trailer, PR create)
5) Workflow Orchestrator wiring red/green/commit loop with coverage gate and scenario iteration
6) Surgical Test Gen integration (red) from JSON Gherkin + AC; minimal‑change impl prompts (green)
7) CLI autopilot (dry‑run → full run) and TUI (tmux panes)
8) PR template and review automation (user story, AC table with test links, scenarios, coverage)

---

## Git/TDD Wiring (Validation‑First)
- Branch naming: include tag + task id (e.g., `master/task-12-user-auth`) to disambiguate context.
- Commit footers (configurable):
  - `Task-Id: <id>`
  - `Subtask-Id: <id>.<sub>` when relevant
  - `Tag: <tag>`
  - Trailer: `Refs: TM-<tag>-<id>[.<sub>] SC:<scenarioId> AC:<acId>`
- Red/Green/Commit loop per subtask:
  - Red: synthesize failing tests from acceptance criteria (Surgical agent)
  - Green: minimal code to pass; re‑run full suite
  - Commit when all tests pass and coverage ≥ 80%
- PR base: repository default branch. Title `Task #<id> [<tag>]: <title>`.
- PR body sections: User Story, Acceptance Criteria, Subtask Summary, Test Results, Coverage Table, Linked Work Items (ids), Next Steps.

---

## Prompts & Parsers (Story Mode)
- PRD/Brief Parser updates:
  - Extract user stories with “As a … I want … so that …” format when present.
  - Extract Acceptance Criteria as bullet list; fill gaps with LLM synthesis from brief context.
  - Emit JSON Gherkin Feature/Scenarios; auto‑split Given/When/Then when feasible; otherwise store text under `then` and refine later.
- Task Generation Prompt (story mode):
  - “Generate a task as a User Story with clear Acceptance Criteria. Do not include implementation details in the story; produce implementation subtasks separately.”
- Subtask Generation Prompt:
  - “Produce technical implementation steps to satisfy the acceptance criteria. Each subtask should be atomic and testable.”
- Test Generation (Red):
  - Use `.claude/agents/surgical-test-generator.md`; seed with JSON Gherkin + Acceptance/Test Criteria; determinism favored over maximum coverage.
  - Record produced test paths back into AC items and optionally scenario annotations.
- Implementation (Green):
  - Minimal diffs, follow patterns, keep commits scoped to the subtask.

---

## TUI (Linear, tmux‑based)
- Left: Tag selector and task list (status/priority). Actions: Expand, Start (Next or Selected), Review.
- Right: Executor terminal (claude‑code/codex) under tmux split; orchestrator logs under another pane.
- Confirmations inline (branch create, push, PR) unless `--no-confirm`.

---

## Migration & Backward Compatibility
- Optional `gherkin` block; existing tasks remain valid.
- When `stories.enabled=true`, new tasks include AC Hybrid + `gherkin`; upgrade path via a utility to synthesize both from description/testStrategy/acceptanceCriteria.

---

## Risks & Mitigations
- Hallucinated acceptance criteria → Always show criteria in PR; allow quick amend and re‑run.
- Framework variance → Test Runner Adapter detects and normalizes execution/coverage; fallback to `test` script.
- Large diffs → Prompt for minimal changes; allow diff preview before commit.
- Flaky tests → Retry policy; isolate targeted runs; enforce passing full suite before commit.

---

## Acceptance Criteria Schema Options (for decision)
- Option A: Markdown only
  - Pros: simple to write/edit, good for humans
  - Cons: hard to map deterministically to tests; weak traceability; brittle diffs
- Option B: Structured array
  - Example: `{ id, summary, given, when, then, severity, tags }`
  - Pros: machine‑readable; strong linking to tests/coverage; easy to diff
  - Cons: heavier authoring; requires schema discipline
- Option C: Hybrid (recommended)
  - Store both: a normalized array of criteria objects and a preserved `raw` markdown block
  - Each criterion gets a stable `id` (e.g., `AC-<taskId>-<n>`) used in tests, commit trailers, and PR tables
  - Enables clean PR tables and deterministic coverage mapping while keeping human‑friendly text

Proposed default schema (hybrid):
```
acceptanceCriteria: {
  raw: """
  - AC1: Guest can checkout with credit card
  - AC2: Declined cards show error inline
  """,
  items: [
    {
      id: "AC-12-1",
      summary: "Guest can checkout with credit card",
      given: "a guest with items in cart",
      when: "submits valid credit card",
      then: "order is created and receipt emailed",
      severity: "must",
      tags: ["checkout", "payments"],
      tests: [] // filled by orchestrator (file paths/test IDs)
    }
  ]
}
```

Decision: adopt Hybrid default; allow Markdown‑only input and auto‑normalize.

## Decisions
- Adopt Hybrid acceptance criteria schema by default; normalize Markdown to structured items with stable IDs `AC-<taskId>-<n>`.
- Use conventional commits plus footers and a unified trailer `Refs: TM-<tag>-<id>[.<sub>]` across PRDs for robust mapping.
