# Phase 1: Core Rails - State Machine & Orchestration

## Objective
Build the WorkflowOrchestrator as a state machine that guides AI sessions through TDD workflow, rather than directly executing code.

## Architecture Overview

### Execution Model
The orchestrator acts as a **state manager and guide**, not a code executor:

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code (MCP Client)                  │
│  - Queries "what to do next"                                │
│  - Executes work (writes tests, code, runs commands)        │
│  - Reports completion                                        │
└────────────────┬────────────────────────────────────────────┘
                 │ MCP Protocol
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              WorkflowOrchestrator (tm-core)                  │
│  - Maintains state machine (RED → GREEN → COMMIT)           │
│  - Returns work units with context                          │
│  - Validates preconditions                                  │
│  - Records progress                                         │
│  - Persists state for resumability                          │
└─────────────────────────────────────────────────────────────┘
```

### Why This Approach?
1. **Separation of Concerns**: State management separate from code execution
2. **Leverage Existing Tools**: Uses Claude Code's capabilities instead of reimplementing
3. **Human-in-the-Loop**: Easy to inspect state and intervene at any phase
4. **Simpler Implementation**: Orchestrator is pure logic, no AI model integration needed
5. **Flexible Executors**: Any tool (Claude Code, human, other AI) can execute work units

## Core Components

### 1. WorkflowOrchestrator Service
**Location**: `packages/tm-core/src/services/workflow-orchestrator.service.ts`

**Responsibilities**:
- Track current phase (RED/GREEN/COMMIT) per subtask
- Generate work units with context for each phase
- Validate phase completion criteria
- Advance state machine on successful completion
- Handle errors and retry logic
- Persist run state for resumability

**API**:
```typescript
interface WorkflowOrchestrator {
  // Start a new autopilot run
  startRun(taskId: string, options?: RunOptions): Promise<RunContext>;

  // Get next work unit to execute
  getNextWorkUnit(runId: string): Promise<WorkUnit | null>;

  // Report work unit completion
  completeWorkUnit(
    runId: string,
    workUnitId: string,
    result: WorkUnitResult
  ): Promise<void>;

  // Get current run state
  getRunState(runId: string): Promise<RunState>;

  // Pause/resume
  pauseRun(runId: string): Promise<void>;
  resumeRun(runId: string): Promise<void>;
}

interface WorkUnit {
  id: string;                    // Unique work unit ID
  phase: 'RED' | 'GREEN' | 'COMMIT';
  subtaskId: string;             // e.g., "42.1"
  action: string;                // Human-readable description
  context: WorkUnitContext;      // All info needed to execute
  preconditions: Precondition[]; // Checks before execution
}

interface WorkUnitContext {
  taskId: string;
  taskTitle: string;
  subtaskTitle: string;
  subtaskDescription: string;
  dependencies: string[];        // Completed subtask IDs
  testCommand: string;           // e.g., "npm test"

  // Phase-specific context
  redPhase?: {
    testFile: string;            // Where to create test
    testFramework: string;       // e.g., "vitest"
    acceptanceCriteria: string[];
  };

  greenPhase?: {
    testFile: string;            // Test to make pass
    implementationHints: string[];
    expectedFiles: string[];     // Files likely to modify
  };

  commitPhase?: {
    commitMessage: string;       // Pre-generated message
    filesToCommit: string[];     // Files modified in RED+GREEN
  };
}

interface WorkUnitResult {
  success: boolean;
  phase: 'RED' | 'GREEN' | 'COMMIT';

  // RED phase results
  testsCreated?: string[];
  testsFailed?: number;

  // GREEN phase results
  testsPassed?: number;
  filesModified?: string[];
  attempts?: number;

  // COMMIT phase results
  commitSha?: string;

  // Common
  error?: string;
  logs?: string;
}

interface RunState {
  runId: string;
  taskId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentPhase: 'RED' | 'GREEN' | 'COMMIT';
  currentSubtask: string;
  completedSubtasks: string[];
  failedSubtasks: string[];
  startTime: Date;
  lastUpdateTime: Date;

  // Resumability
  checkpoint: {
    subtaskId: string;
    phase: 'RED' | 'GREEN' | 'COMMIT';
    attemptNumber: number;
  };
}
```

### 2. State Machine Logic

**Phase Transitions**:
```
START → RED(subtask 1) → GREEN(subtask 1) → COMMIT(subtask 1)
                                               ↓
                        RED(subtask 2) ← ─ ─ ─ ┘
                             ↓
                        GREEN(subtask 2)
                             ↓
                        COMMIT(subtask 2)
                             ↓
                           (repeat for remaining subtasks)
                             ↓
                        FINALIZE → END
```

**Phase Rules**:
- **RED**: Can only transition to GREEN if tests created and failing
- **GREEN**: Can only transition to COMMIT if tests passing (attempt < maxAttempts)
- **COMMIT**: Can only transition to next RED if commit successful
- **FINALIZE**: Can only start if all subtasks completed

**Preconditions**:
- RED: No uncommitted changes (or staged from previous GREEN that failed)
- GREEN: RED phase complete, tests exist and are failing
- COMMIT: GREEN phase complete, all tests passing, coverage meets threshold

### 3. MCP Integration

**New MCP Tools** (expose WorkflowOrchestrator via MCP):
```typescript
// Start an autopilot run
mcp__task_master_ai__autopilot_start(taskId: string, dryRun?: boolean)

// Get next work unit
mcp__task_master_ai__autopilot_next_work_unit(runId: string)

// Complete current work unit
mcp__task_master_ai__autopilot_complete_work_unit(
  runId: string,
  workUnitId: string,
  result: WorkUnitResult
)

// Get run state
mcp__task_master_ai__autopilot_get_state(runId: string)

// Pause/resume
mcp__task_master_ai__autopilot_pause(runId: string)
mcp__task_master_ai__autopilot_resume(runId: string)
```

### 4. Git/Test Adapters

**GitAdapter** (`packages/tm-core/src/services/git-adapter.service.ts`):
- Check working tree status
- Validate branch state
- Read git config (user, remote, default branch)
- **Does NOT execute** git commands (that's executor's job)

**TestAdapter** (`packages/tm-core/src/services/test-adapter.service.ts`):
- Detect test framework from package.json
- Parse test output (failures, passes, coverage)
- Validate coverage thresholds
- **Does NOT run** tests (that's executor's job)

### 5. Run State Persistence

**Storage Location**: `.taskmaster/reports/runs/<runId>/`

**Files**:
- `state.json` - Current run state (for resumability)
- `log.jsonl` - Event stream (timestamped work unit completions)
- `manifest.json` - Run metadata
- `work-units.json` - All work units generated for this run

**Example `state.json`**:
```json
{
  "runId": "2025-01-15-142033",
  "taskId": "42",
  "status": "paused",
  "currentPhase": "GREEN",
  "currentSubtask": "42.2",
  "completedSubtasks": ["42.1"],
  "failedSubtasks": [],
  "checkpoint": {
    "subtaskId": "42.2",
    "phase": "GREEN",
    "attemptNumber": 2
  },
  "startTime": "2025-01-15T14:20:33Z",
  "lastUpdateTime": "2025-01-15T14:35:12Z"
}
```

## Implementation Plan

### Step 1: WorkflowOrchestrator Skeleton
- [ ] Create `workflow-orchestrator.service.ts` with interfaces
- [ ] Implement state machine logic (phase transitions)
- [ ] Add run state persistence (state.json, log.jsonl)
- [ ] Write unit tests for state machine

### Step 2: Work Unit Generation
- [ ] Implement `getNextWorkUnit()` with context assembly
- [ ] Generate RED phase work units (test file paths, criteria)
- [ ] Generate GREEN phase work units (implementation hints)
- [ ] Generate COMMIT phase work units (commit messages)

### Step 3: Git/Test Adapters
- [ ] Create GitAdapter for status checks only
- [ ] Create TestAdapter for output parsing only
- [ ] Add precondition validation using adapters
- [ ] Write adapter unit tests

### Step 4: MCP Integration
- [ ] Add MCP tool definitions in `packages/mcp-server/src/tools/`
- [ ] Wire up WorkflowOrchestrator to MCP tools
- [ ] Test MCP tools via Claude Code
- [ ] Document MCP workflow in CLAUDE.md

### Step 5: CLI Integration
- [ ] Update `autopilot.command.ts` to call WorkflowOrchestrator
- [ ] Add `--interactive` mode that shows work units and waits for completion
- [ ] Add `--resume` flag to continue paused runs
- [ ] Test end-to-end flow

### Step 6: Integration Testing
- [ ] Create test task with 2-3 subtasks
- [ ] Run autopilot start → get work unit → complete → repeat
- [ ] Verify state persistence and resumability
- [ ] Test failure scenarios (test failures, git issues)

## Success Criteria
- [ ] WorkflowOrchestrator can generate work units for all phases
- [ ] MCP tools allow Claude Code to query and complete work units
- [ ] State persists correctly between work unit completions
- [ ] Run can be paused and resumed from checkpoint
- [ ] Adapters validate preconditions without executing commands
- [ ] End-to-end: Claude Code can complete a simple task via work units

## Out of Scope (Phase 1)
- Actual git operations (branch creation, commits) - executor handles this
- Actual test execution - executor handles this
- PR creation - deferred to Phase 2
- TUI interface - deferred to Phase 3
- Coverage enforcement - deferred to Phase 2

## Example Usage Flow

```bash
# Terminal 1: Claude Code session
$ claude

# In Claude Code (via MCP):
> Start autopilot for task 42
[Calls mcp__task_master_ai__autopilot_start(42)]
→ Run started: run-2025-01-15-142033

> Get next work unit
[Calls mcp__task_master_ai__autopilot_next_work_unit(run-2025-01-15-142033)]
→ Work unit: RED phase for subtask 42.1
→ Action: Generate failing tests for metrics schema
→ Test file: src/__tests__/schema.test.js
→ Framework: vitest

> [Claude Code creates test file, runs tests]

> Complete work unit
[Calls mcp__task_master_ai__autopilot_complete_work_unit(
  run-2025-01-15-142033,
  workUnit-42.1-RED,
  { success: true, testsCreated: ['src/__tests__/schema.test.js'], testsFailed: 3 }
)]
→ Work unit completed. State saved.

> Get next work unit
[Calls mcp__task_master_ai__autopilot_next_work_unit(run-2025-01-15-142033)]
→ Work unit: GREEN phase for subtask 42.1
→ Action: Implement code to pass failing tests
→ Test file: src/__tests__/schema.test.js
→ Expected implementation: src/schema.js

> [Claude Code implements schema.js, runs tests, confirms all pass]

> Complete work unit
[...]
→ Work unit completed. Ready for COMMIT.

> Get next work unit
[...]
→ Work unit: COMMIT phase for subtask 42.1
→ Commit message: "feat(metrics): add metrics schema (task 42.1)"
→ Files to commit: src/__tests__/schema.test.js, src/schema.js

> [Claude Code stages files and commits]

> Complete work unit
[...]
→ Subtask 42.1 complete! Moving to 42.2...
```

## Dependencies
- Existing TaskService (task loading, status updates)
- Existing PreflightChecker (environment validation)
- Existing TaskLoaderService (dependency ordering)
- MCP server infrastructure

## Estimated Effort
7-10 days

## Next Phase
Phase 2 will add:
- PR creation via gh CLI
- Coverage enforcement
- Enhanced error recovery
- Full resumability testing
