# Phase 1: Core Rails - Autonomous TDD Workflow

## Objective
Implement the core autonomous TDD workflow with safe git operations, test generation/execution, and commit gating.

## Scope
- WorkflowOrchestrator with event stream
- Git and Test adapters
- Subtask loop (RED → GREEN → COMMIT)
- Framework-agnostic test generation using Surgical Test Generator
- Test execution with detected test command
- Commit gating on passing tests and coverage
- Branch/tag mapping
- Run report persistence

## Deliverables

### 1. WorkflowOrchestrator (`packages/tm-core/src/services/workflow-orchestrator.ts`)

**Responsibilities:**
- State machine driving phases: Preflight → Branch/Tag → SubtaskIter → Finalize
- Event emission for progress tracking
- Coordination of Git, Test, and Executor adapters
- Run state persistence

**API:**
```typescript
class WorkflowOrchestrator {
  async executeTask(taskId: string, options: AutopilotOptions): Promise<RunResult>
  async resume(runId: string): Promise<RunResult>
  on(event: string, handler: (data: any) => void): void

  // Events emitted:
  // - 'phase:start' { phase, timestamp }
  // - 'phase:complete' { phase, status, timestamp }
  // - 'subtask:start' { subtaskId, phase }
  // - 'subtask:complete' { subtaskId, phase, status }
  // - 'test:run' { subtaskId, phase, results }
  // - 'commit:created' { subtaskId, sha, message }
  // - 'error' { phase, error, recoverable }
}
```

**State Machine Phases:**
1. Preflight - validate environment
2. BranchSetup - create branch, set tag
3. SubtaskLoop - for each subtask: RED → GREEN → COMMIT
4. Finalize - full test suite, coverage check
5. Complete - run report, cleanup

### 2. GitAdapter (`packages/tm-core/src/services/git-adapter.ts`)

**Responsibilities:**
- All git operations with safety checks
- Branch name generation from tag/task
- Confirmation gates for destructive operations

**API:**
```typescript
class GitAdapter {
  async isWorkingTreeClean(): Promise<boolean>
  async getCurrentBranch(): Promise<string>
  async getDefaultBranch(): Promise<string>
  async createBranch(name: string): Promise<void>
  async checkoutBranch(name: string): Promise<void>
  async commit(message: string, files?: string[]): Promise<string>
  async push(branch: string, remote?: string): Promise<void>

  // Safety checks
  async assertNotOnDefaultBranch(): Promise<void>
  async assertCleanOrConfirm(): Promise<void>

  // Branch naming
  generateBranchName(tag: string, taskId: string, slug: string): string
}
```

**Guardrails:**
- Never allow commits on default branch
- Always check working tree before branch creation
- Confirm destructive operations unless `--no-confirm` flag

### 3. TestRunnerAdapter (`packages/tm-core/src/services/test-runner-adapter.ts`)

**Responsibilities:**
- Detect test command from package.json
- Execute tests (targeted and full suite)
- Parse test results and coverage
- Enforce coverage thresholds

**API:**
```typescript
class TestRunnerAdapter {
  async detectTestCommand(): Promise<string>
  async runTargeted(pattern: string): Promise<TestResults>
  async runAll(): Promise<TestResults>
  async getCoverage(): Promise<CoverageReport>
  async meetsThresholds(coverage: CoverageReport): Promise<boolean>
}

interface TestResults {
  exitCode: number
  duration: number
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
  failures: Array<{
    test: string
    error: string
    stack?: string
  }>
}

interface CoverageReport {
  lines: number
  branches: number
  functions: number
  statements: number
}
```

**Detection Logic:**
- Check package.json → scripts.test
- Support: npm test, pnpm test, yarn test, bun test
- Fall back to explicit command from config

### 4. Test Generation Integration

**Use Surgical Test Generator:**
- Load prompt from `.claude/agents/surgical-test-generator.md`
- Compose with task/subtask context
- Generate tests via executor (Claude)
- Write test files to detected locations

**Prompt Composition:**
```typescript
async function composeRedPrompt(subtask: Subtask, context: ProjectContext): Promise<string> {
  const systemPrompts = [
    loadFile('.cursor/rules/git_workflow.mdc'),
    loadFile('.cursor/rules/test_workflow.mdc'),
    loadFile('.claude/agents/surgical-test-generator.md')
  ]

  const taskContext = formatTaskContext(subtask)
  const instruction = formatRedInstruction(subtask, context)

  return [
    ...systemPrompts,
    '<TASK CONTEXT>',
    taskContext,
    '<INSTRUCTION>',
    instruction
  ].join('\n\n')
}
```

### 5. Subtask Loop Implementation

**RED Phase:**
1. Compose test generation prompt with subtask context
2. Execute via Claude executor
3. Parse generated test file paths and code
4. Write test files to filesystem
5. Run tests to confirm they fail (red state)
6. Store test results in run artifacts
7. If tests pass unexpectedly, warn and skip to next subtask

**GREEN Phase:**
1. Compose implementation prompt with test failures
2. Execute via Claude executor with max attempts (default: 3)
3. Parse implementation changes
4. Apply changes to filesystem
5. Run tests to verify passing (green state)
6. If tests still fail after max attempts:
   - Save current state
   - Emit pause event
   - Return resumable checkpoint
7. If tests pass, proceed to COMMIT

**COMMIT Phase:**
1. Verify all tests pass
2. Check coverage meets thresholds (if enabled)
3. Generate conventional commit message
4. Stage test files + implementation files
5. Commit with message
6. Update subtask status to 'done'
7. Emit commit event with SHA
8. Continue to next subtask

### 6. Branch & Tag Management

**Integration with existing tag system:**
- Use `scripts/modules/task-manager/tag-management.js`
- Explicit tag switching when branch created
- Store branch ↔ tag mapping in run state

**Branch Naming:**
- Pattern from config: `{tag}/task-{id}-{slug}`
- Default: `analytics/task-42-user-metrics`
- Sanitize: lowercase, replace spaces with hyphens

### 7. Run Artifacts & State Persistence

**Directory structure:**
```
.taskmaster/reports/runs/<run-id>/
├── manifest.json          # run metadata
├── log.jsonl              # event stream
├── commits.txt            # commit SHAs
├── test-results/
│   ├── subtask-42.1-red.json
│   ├── subtask-42.1-green.json
│   ├── subtask-42.2-red.json
│   ├── subtask-42.2-green-attempt1.json
│   ├── subtask-42.2-green-attempt2.json
│   └── final-suite.json
└── state.json             # resumable checkpoint
```

**manifest.json:**
```json
{
  "runId": "2025-01-15-142033",
  "taskId": "42",
  "tag": "analytics",
  "branch": "analytics/task-42-user-metrics",
  "startTime": "2025-01-15T14:20:33Z",
  "endTime": null,
  "status": "in-progress",
  "currentPhase": "subtask-loop",
  "currentSubtask": "42.2",
  "subtasksCompleted": ["42.1"],
  "subtasksFailed": [],
  "totalCommits": 1
}
```

**log.jsonl** (append-only event log):
```jsonl
{"ts":"2025-01-15T14:20:33Z","event":"phase:start","phase":"preflight","status":"ok"}
{"ts":"2025-01-15T14:21:00Z","event":"subtask:start","subtask":"42.1","phase":"red"}
{"ts":"2025-01-15T14:22:00Z","event":"test:run","subtask":"42.1","phase":"red","results":{"passed":0,"failed":3}}
{"ts":"2025-01-15T14:23:00Z","event":"subtask:start","subtask":"42.1","phase":"green"}
{"ts":"2025-01-15T14:24:30Z","event":"test:run","subtask":"42.1","phase":"green","attempt":1,"results":{"passed":3,"failed":0}}
{"ts":"2025-01-15T14:24:35Z","event":"commit:created","subtask":"42.1","sha":"a1b2c3d","message":"feat(metrics): add metrics schema (task 42.1)"}
```

### 8. CLI Command Implementation

**Update `tm autopilot` command:**
- Remove `--dry-run` only behavior
- Execute actual workflow when flag not present
- Add progress reporting via orchestrator events
- Support `--no-confirm` for CI/automation
- Support `--max-attempts` to override default

**Real-time output:**
```bash
$ tm autopilot 42

🚀 Starting autopilot for Task #42 [analytics]: User metrics tracking

✓ Preflight checks passed
✓ Created branch: analytics/task-42-user-metrics
✓ Set active tag: analytics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/3] Subtask 42.1: Add metrics schema

  RED   Generating tests... ⏳
  RED   ✓ Tests created: src/__tests__/schema.test.js
  RED   ✓ Tests failing: 3 failed, 0 passed

  GREEN Implementing code... ⏳
  GREEN ✓ Tests passing: 3 passed, 0 failed (attempt 1)

  COMMIT ✓ Committed: a1b2c3d
         "feat(metrics): add metrics schema (task 42.1)"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[2/3] Subtask 42.2: Add collection endpoint
  ...
```

## Success Criteria
- Can execute a simple task end-to-end without manual intervention
- All commits made on feature branch, never on default branch
- Tests are generated before implementation (RED → GREEN order enforced)
- Only commits when tests pass and coverage meets threshold
- Run state is persisted and can be inspected post-run
- Clear error messages when things go wrong
- Orchestrator events allow CLI to show live progress

## Configuration

**Add to `.taskmaster/config.json`:**
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
    "defaultRemote": "origin"
  }
}
```

## Out of Scope (defer to Phase 2)
- PR creation (gh integration)
- Resume functionality (`--resume` flag)
- Lint/format step
- Multiple executor support (only Claude)

## Implementation Order
1. GitAdapter with safety checks
2. TestRunnerAdapter with detection logic
3. WorkflowOrchestrator state machine skeleton
4. RED phase: test generation integration
5. GREEN phase: implementation with retry logic
6. COMMIT phase: gating and persistence
7. CLI command wiring with event handling
8. Run artifacts and logging

## Testing Strategy
- Unit tests for each adapter (mock git/test commands)
- Integration tests with real git repo (temporary directory)
- End-to-end test with sample task in test project
- Verify no commits on default branch (security test)
- Verify commit gating works (force test failure, ensure no commit)

## Dependencies
- Phase 0 completed (CLI skeleton, preflight checks)
- Existing TaskService and executor infrastructure
- Surgical Test Generator prompt file exists

## Estimated Effort
2-3 weeks

## Risks & Mitigations
- **Risk:** Test generation produces invalid/wrong tests
  - **Mitigation:** Use Surgical Test Generator prompt, add manual review step in early iterations

- **Risk:** Implementation attempts timeout/fail repeatedly
  - **Mitigation:** Max attempts with pause/resume; store state for manual intervention

- **Risk:** Coverage parsing fails on different test frameworks
  - **Mitigation:** Start with one framework (vitest), add parsers incrementally

- **Risk:** Git operations fail (conflicts, permissions)
  - **Mitigation:** Detailed error messages, save state before destructive ops

## Validation
Test with:
- Simple task (1 subtask, clear requirements)
- Medium task (3 subtasks with dependencies)
- Task requiring multiple GREEN attempts
- Task with dirty working tree (should error)
- Task on default branch (should error)
- Project without test command (should error with helpful message)
