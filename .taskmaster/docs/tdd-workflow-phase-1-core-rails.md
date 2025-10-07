# Phase 1: Core Rails - Autonomous TDD Workflow

## Objective
Implement the core autonomous TDD workflow with safe git operations, test generation/execution, and commit gating.

## Scope
- WorkflowOrchestrator with event stream
- GitAdapter and TestResultValidator
- Subtask loop (RED → GREEN → COMMIT)
- CLI commands for AI agent orchestration
- MCP tools for AI agent orchestration
- Test result validation (AI reports, TaskMaster validates)
- Commit creation with enhanced metadata
- Branch/tag mapping
- Global storage for state and activity logs
- Framework-agnostic design (AI runs tests, not TaskMaster)
- Run report persistence

## Key Design Decisions

### Global Storage (`~/.taskmaster/`)
- **Why:** Keeps project directory clean, client-friendly, no tooling evidence in PRs
- **What:** All runtime state, logs, and throwaway artifacts
- **Where:** `~/.taskmaster/projects/<project-path>/runs/<run-id>/`

### Dual System: State + Activity Log
- **State (`state.json`):** For orchestration, tells AI what to do next, mutable
- **Activity Log (`activity.jsonl`):** For debugging/audit, append-only event stream
- **Separation:** Optimizes for different use cases (fast reads vs. complete history)

### Enhanced Commit Messages
- **Why:** Enables future task-checker bot validation without external dependencies
- **What:** Embeds task ID, phase, tag, test counts, coverage in commit body
- **Benefit:** PR contains full context for review and automated validation

### Worktree Support
- **Why:** Enables parallel autonomous agents on different branches
- **How:** Each worktree has independent global state directory
- **Isolation:** No conflicts, complete separation

### Framework-Agnostic Test Execution
- **AI runs tests:** AI agent knows project context and test framework (npm test, pytest, go test)
- **TaskMaster validates:** Only checks that RED fails and GREEN passes
- **No framework detection:** TaskMaster doesn't need to know Jest vs Vitest vs pytest
- **Trust but verify:** AI reports results, TaskMaster validates they make sense
- **Language agnostic:** Works with any language/framework without TaskMaster changes

### AI Agent Orchestration Model
- **Who executes:** User's AI agent (Claude Code, Cursor, Windsurf, etc.) - not TaskMaster
- **TaskMaster's role:** Workflow orchestration, validation, commit creation
- **AI agent's role:** Code generation, test execution, result reporting
- **Communication:** Via CLI commands or MCP tools
- **State-driven:** AI agent reads `state.json` to know what to do next

**Separation of Concerns:**

| TaskMaster Responsibilities | AI Agent Responsibilities |
|----------------------------|---------------------------|
| Workflow state machine | Generate tests |
| Validate phase transitions | Run tests (knows test framework) |
| Create commits with metadata | Implement code |
| Store activity logs | Report test results |
| Manage git operations | Understand project context |
| Track progress | Choose appropriate test commands |

**Flow:**
```
AI Agent                                    TaskMaster
   │                                            │
   ├──► tm autopilot start 1                    │
   │                                            ├──► Creates state, branch
   │                                            ├──► Returns: "next action: RED phase for 1.1"
   │                                            │
   ├──► tm autopilot next                       │
   │                                            ├──► Reads state.json
   │                                            ├──► Returns: { phase: "red", subtask: "1.1", context: {...} }
   │                                            │
   │    Generate tests (AI does this)           │
   │    npm test (AI runs this)                 │
   │    Results: 3 failed, 0 passed             │
   │                                            │
   ├──► tm autopilot complete red 1.1 \         │
   │    --results="failed:3,passed:0"           │
   │                                            ├──► Validates: tests failed ✓
   │                                            ├──► Updates state to GREEN
   │                                            ├──► Returns: "next action: GREEN phase"
   │                                            │
   ├──► tm autopilot next                       │
   │                                            ├──► Returns: { phase: "green", subtask: "1.1" }
   │                                            │
   │    Implement code (AI does this)           │
   │    npm test (AI runs this)                 │
   │    Results: 3 passed, 0 failed             │
   │                                            │
   ├──► tm autopilot complete green 1.1 \       │
   │    --results="passed:3,failed:0"           │
   │                                            ├──► Validates: tests passed ✓
   │                                            ├──► Updates state to COMMIT
   │                                            ├──► Returns: "next action: COMMIT phase"
   │                                            │
   ├──► tm autopilot commit 1.1                 │
   │                                            ├──► Detects changed files (git status)
   │                                            ├──► Stages files
   │                                            ├──► Creates commit with metadata
   │                                            ├──► Updates state to next subtask
   │                                            ├──► Returns: { sha: "a1b2c3d", nextAction: {...} }
   │                                            │
   └──► Loop continues...                        │
```

**Key principle:** AI agent is the domain expert (knows the codebase, frameworks, tools). TaskMaster is the workflow expert (knows TDD process, state management, git operations).

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

### 3. Test Result Validator (`packages/tm-core/src/services/test-result-validator.ts`)

**Responsibilities:**
- Validate test results reported by AI agent
- Ensure RED phase has failing tests
- Ensure GREEN phase has passing tests
- Enforce coverage thresholds (if provided)

**API:**
```typescript
class TestResultValidator {
  async validateRedPhase(results: TestResults): Promise<ValidationResult>
  async validateGreenPhase(results: TestResults, coverage?: number): Promise<ValidationResult>
  async meetsThresholds(coverage: number): Promise<boolean>
}

interface TestResults {
  passed: number
  failed: number
  skipped?: number
  total: number
}

interface ValidationResult {
  valid: boolean
  message: string
  suggestion?: string
}
```

**Validation Logic:**
```typescript
async function validateRedPhase(results: TestResults): ValidationResult {
  if (results.failed === 0) {
    return {
      valid: false,
      message: "RED phase requires failing tests. All tests passed.",
      suggestion: "Verify tests are checking expected behavior. Tests should fail before implementation."
    }
  }

  if (results.passed > 0) {
    return {
      valid: true,
      message: `RED phase valid: ${results.failed} failing, ${results.passed} passing (existing tests)`,
      warning: "Some tests passing - ensure new tests are failing"
    }
  }

  return {
    valid: true,
    message: `RED phase complete: ${results.failed} tests failing as expected`
  }
}

async function validateGreenPhase(results: TestResults): ValidationResult {
  if (results.failed > 0) {
    return {
      valid: false,
      message: `GREEN phase incomplete: ${results.failed} tests still failing`,
      suggestion: "Continue implementing until all tests pass or retry GREEN phase"
    }
  }

  return {
    valid: true,
    message: `GREEN phase complete: ${results.passed} tests passing`
  }
}
```

**Note:** AI agent is responsible for:
- Running test commands (knows npm test vs pytest vs go test)
- Parsing test output
- Reporting results to TaskMaster

TaskMaster only validates the reported numbers make sense for the phase.

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
1. TaskMaster returns RED action with subtask context
2. AI agent generates tests (TaskMaster not involved)
3. AI agent writes test files (TaskMaster not involved)
4. AI agent runs tests using project's test command (e.g., npm test)
5. AI agent reports results: `tm autopilot complete red <id> --results="failed:3,passed:0"`
6. TaskMaster validates: tests should have failures
7. If validation fails (tests passed), return error with suggestion
8. If validation passes, update state to GREEN, store results in activity log
9. Return next action (GREEN phase)

**GREEN Phase:**
1. TaskMaster returns GREEN action with subtask context
2. AI agent implements code (TaskMaster not involved)
3. AI agent runs tests using project's test command
4. AI agent reports results: `tm autopilot complete green <id> --results="passed:5,failed:0" --coverage="85"`
5. TaskMaster validates: all tests should pass
6. If validation fails (tests still failing):
   - Increment attempt counter
   - If under max attempts: return GREEN action again with attempt number
   - If max attempts reached: save state, emit pause event, return resumable checkpoint
7. If validation passes: update state to COMMIT, store results in activity log
8. Return next action (COMMIT phase)

**COMMIT Phase:**
1. TaskMaster receives commit command: `tm autopilot commit <id>`
2. Detect changed files: `git status --porcelain`
3. Validate coverage meets thresholds (if provided and threshold configured)
4. Generate conventional commit message with task metadata
5. Stage files: `git add <files>`
6. Create commit: `git commit -m "<message>"`
7. Update subtask status to 'done' in tasks.json
8. Log commit event to activity.jsonl
9. Update state to next subtask's RED phase
10. Return next action

**Key changes from original design:**
- AI agent runs all test commands (framework agnostic)
- TaskMaster only validates reported results
- No test framework detection needed
- No test execution by TaskMaster
- AI agent is trusted to report accurate results

### 6. Branch & Tag Management

**Integration with existing tag system:**
- Use `scripts/modules/task-manager/tag-management.js`
- Explicit tag switching when branch created
- Store branch ↔ tag mapping in run state

**Branch Naming:**
- Pattern from config: `{tag}/task-{id}-{slug}`
- Default: `analytics/task-42-user-metrics`
- Sanitize: lowercase, replace spaces with hyphens

### 7. Global Storage & State Management

**Philosophy:**
- All runtime state, logs, and throwaway artifacts stored globally in `~/.taskmaster/`
- Project directory stays clean - only code changes and tasks.json versioned
- Enables single-player autonomous mode without polluting PRs
- Client-friendly: no evidence of tooling in source code

**Global directory structure:**
```
~/.taskmaster/
├── projects/
│   └── <project-path-normalized>/
│       ├── runs/
│       │   └── <tag>__task-<id>__<timestamp>/
│       │       ├── manifest.json          # run metadata
│       │       ├── activity.jsonl         # event stream (debugging)
│       │       ├── state.json             # resumable checkpoint
│       │       ├── commits.txt            # commit SHAs
│       │       └── test-results/
│       │           ├── subtask-1.1-red.json
│       │           ├── subtask-1.1-green.json
│       │           └── final-suite.json
│       └── tags/
│           └── <tag-name>/
│               └── current-run.json       # active run pointer
└── cache/
    └── templates/                          # shared templates
```

**Project path normalization:**
```typescript
function getProjectStoragePath(projectRoot: string): string {
  const normalized = projectRoot
    .replace(/\//g, '-')
    .replace(/^-/, '')

  return path.join(os.homedir(), '.taskmaster', 'projects', normalized)
  // Example: ~/.taskmaster/projects/-Volumes-Workspace-contrib-task-master-claude-task-master
}
```

**Run ID generation:**
```typescript
function generateRunId(tag: string, taskId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${tag}__task-${taskId}__${timestamp}`
  // Example: tdd-workflow-phase-0__task-1__2025-10-07T14-30-00-000Z
}
```

**manifest.json:**
```json
{
  "runId": "tdd-workflow-phase-0__task-1__2025-10-07T14-30-00-000Z",
  "projectRoot": "/Volumes/Workspace/contrib/task-master/claude-task-master",
  "taskId": "1",
  "tag": "tdd-workflow-phase-0",
  "branch": "tdd-phase-0-implementation",
  "startTime": "2025-10-07T14:30:00Z",
  "endTime": null,
  "status": "in-progress",
  "currentPhase": "subtask-loop",
  "currentSubtask": "1.2",
  "subtasksCompleted": ["1.1"],
  "subtasksFailed": [],
  "totalCommits": 1
}
```

**state.json** (orchestration state):
```json
{
  "runId": "tdd-workflow-phase-0__task-1__2025-10-07T14-30-00-000Z",
  "taskId": "1",
  "tag": "tdd-workflow-phase-0",
  "branch": "tdd-phase-0-implementation",
  "currentSubtask": "1.2",
  "currentPhase": "green",
  "attemptNumber": 1,
  "maxAttempts": 3,
  "completedSubtasks": ["1.1"],
  "pendingSubtasks": ["1.2", "1.3", "1.4"],
  "nextAction": {
    "type": "implement",
    "subtask": "1.2",
    "phase": "green",
    "context": {
      "testFile": "src/__tests__/preflight.test.ts",
      "failingTests": [
        "should detect test runner from package.json",
        "should validate git working tree"
      ],
      "implementationFiles": ["src/services/preflight-checker.ts"]
    }
  },
  "lastUpdated": "2025-10-07T14:31:45Z",
  "canResume": true
}
```

**activity.jsonl** (append-only event log):
```jsonl
{"ts":"2025-10-07T14:30:00Z","event":"phase:start","phase":"preflight","status":"ok"}
{"ts":"2025-10-07T14:30:15Z","event":"phase:complete","phase":"preflight","checks":{"git":true,"test":true,"tools":true}}
{"ts":"2025-10-07T14:30:20Z","event":"branch:created","branch":"tdd-phase-0-implementation"}
{"ts":"2025-10-07T14:30:22Z","event":"tag:switched","from":"master","to":"tdd-workflow-phase-0"}
{"ts":"2025-10-07T14:30:25Z","event":"subtask:start","subtaskId":"1.1","phase":"red"}
{"ts":"2025-10-07T14:31:10Z","event":"test:generated","files":["src/__tests__/autopilot.test.ts"],"testCount":3}
{"ts":"2025-10-07T14:31:15Z","event":"test:run","subtaskId":"1.1","phase":"red","passed":0,"failed":3,"status":"expected"}
{"ts":"2025-10-07T14:31:20Z","event":"phase:transition","from":"red","to":"green"}
{"ts":"2025-10-07T14:32:45Z","event":"code:modified","files":["src/commands/autopilot.ts"],"linesChanged":"+58,-0"}
{"ts":"2025-10-07T14:33:00Z","event":"test:run","subtaskId":"1.1","phase":"green","attempt":1,"passed":3,"failed":0,"status":"success"}
{"ts":"2025-10-07T14:33:15Z","event":"commit:created","subtaskId":"1.1","sha":"a1b2c3d","message":"feat(cli): add autopilot command skeleton (task 1.1)"}
{"ts":"2025-10-07T14:33:20Z","event":"subtask:complete","subtaskId":"1.1","duration":"180s"}
```

**current-run.json** (active run pointer):
```json
{
  "runId": "tdd-workflow-phase-0__task-1__2025-10-07T14-30-00-000Z",
  "taskId": "1",
  "tag": "tdd-workflow-phase-0",
  "startTime": "2025-10-07T14:30:00Z",
  "status": "in-progress"
}
```

**What stays in project (versioned):**
```
<project>/
├── .taskmaster/
│   ├── tasks/
│   │   └── tasks.json              # ✅ Versioned (task definitions)
│   └── config.json                 # ✅ Versioned (shared config)
└── .gitignore                       # Add: .taskmaster/state/, .taskmaster/reports/
```

**State vs Activity Log:**

| State File (state.json) | Activity Log (activity.jsonl) |
|------------------------|-------------------------------|
| Current position | Full history |
| What to do next | What happened |
| Mutable (updated) | Immutable (append-only) |
| For orchestration | For debugging/audit |
| Single JSON object | Line-delimited JSON |
| Small (~2KB) | Can grow large |

**Resume logic:**
```typescript
async function resumeWorkflow(): Promise<void> {
  // 1. Find active run
  const currentRun = await loadJSON('~/.taskmaster/projects/<project>/tags/<tag>/current-run.json')

  // 2. Load state from that run
  const state = await loadJSON(`~/.taskmaster/projects/<project>/runs/${currentRun.runId}/state.json`)

  // 3. Continue from checkpoint
  return orchestrator.resumeFrom(state)
}
```

### 8. Enhanced Commit Message Format

**Purpose:**
- Embed task context in commits for future validation
- Enable task-checker bot to verify alignment
- Provide audit trail without needing external logs in PR

**Commit message template:**
```
{type}({scope}): {summary} (task {taskId})

{detailed description}

Task: #{taskId} - {taskTitle}
Phase: {phaseName}
Tag: {tagName}

Tests: {testCount} passing
Coverage: {coveragePercent}% lines
```

**Example commit:**
```
feat(cli): add autopilot command skeleton (task 1.1)

Implements AutopilotCommand class with Commander.js integration.
Adds argument parsing for task ID and dry-run flag. Includes basic
command registration and help text following existing CLI patterns.

Task: #1.1 - Create command structure
Phase: Phase 0 - Spike
Tag: tdd-workflow-phase-0

Tests: 3 passing
Coverage: 92% lines
```

**Conventional commit types:**
- `feat` - New feature or capability
- `fix` - Bug fix
- `test` - Test-only changes
- `refactor` - Code restructuring without behavior change
- `docs` - Documentation updates
- `chore` - Build/tooling changes

**Scope determination:**
```typescript
function determineScope(files: string[]): string {
  // Extract common scope from changed files
  const scopes = files.map(f => {
    if (f.startsWith('apps/cli/')) return 'cli'
    if (f.startsWith('packages/tm-core/')) return 'core'
    if (f.startsWith('packages/tm-mcp/')) return 'mcp'
    return 'misc'
  })

  // Use most common scope
  return mode(scopes)
}
```

**Commit validation (future task-checker bot):**
```typescript
async function validateCommit(commit: Commit, task: Task): Promise<ValidationResult> {
  const taskId = extractTaskId(commit.message)  // "1.1"
  const task = await loadTask(taskId)

  return aiChecker.validate({
    commitDiff: commit.diff,
    commitMessage: commit.message,
    taskDescription: task.description,
    acceptanceCriteria: task.acceptanceCriteria,
    testStrategy: task.testStrategy
  })
}
```

### 9. CLI Commands for AI Agent Orchestration

**New CLI commands** (all under `tm autopilot` namespace):

```bash
# Start workflow - creates branch, initializes state
tm autopilot start <taskId> [options]
  --branch <name>       # Override branch name
  --no-confirm          # Skip confirmations
  --max-attempts <n>    # Override max GREEN attempts

# Get next action from state
tm autopilot next [options]
  --json                # Output as JSON for parsing

# Complete a phase and report test results
tm autopilot complete <phase> <subtaskId> --results="<passed:n,failed:n>" [options]
  # phase: red | green
  --results <passed:n,failed:n>  # Required: test results from AI
  --coverage <percentage>        # Optional: coverage percentage
  --files <file1,file2>          # Optional: files changed (auto-detected if omitted)

# Create commit (called by AI after GREEN passes)
tm autopilot commit <subtaskId> [options]
  --message <msg>       # Override commit message

# Resume from interrupted run
tm autopilot resume [options]
  --run-id <id>         # Specific run to resume

# Get current status
tm autopilot status
  --json                # Output as JSON

# Watch activity log in real-time
tm autopilot watch

# Abort current run
tm autopilot abort [options]
  --cleanup             # Delete branch and state
```

**Command details:**

**`tm autopilot start <taskId>`**
- Creates global state directory
- Creates feature branch
- Switches tag
- Initializes state.json with first subtask
- Returns next action (RED phase for first subtask)

**`tm autopilot next`**
- Reads `~/.taskmaster/projects/<project>/tags/<tag>/current-run.json`
- Reads `~/.taskmaster/projects/<project>/runs/<run-id>/state.json`
- Returns next action with full context

Output:
```json
{
  "action": "red",
  "subtask": {
    "id": "1.1",
    "title": "Create command structure",
    "description": "...",
    "testStrategy": "..."
  },
  "context": {
    "projectRoot": "/path/to/project",
    "testPattern": "**/*.test.ts",
    "existingTests": []
  },
  "instructions": "Generate tests for this subtask. Tests should fail initially."
}
```

**`tm autopilot complete <phase> <subtaskId>`**
- Receives test results from AI agent
- Validates phase completion:
  - **RED**: Ensures reported results show failures
  - **GREEN**: Ensures reported results show all tests passing
- Updates state to next phase
- Logs event to activity.jsonl with test results
- Returns next action

**Examples:**
```bash
# After AI generates tests and runs them
tm autopilot complete red 1.1 --results="failed:3,passed:0"

# After AI implements code and runs tests
tm autopilot complete green 1.1 --results="passed:3,failed:0" --coverage="92"

# With existing passing tests
tm autopilot complete red 1.1 --results="failed:3,passed:12"
```

**`tm autopilot commit <subtaskId>`**
- Generates commit message from template
- Stages files
- Creates commit with enhanced message
- Updates subtask status to 'done'
- Updates state to next subtask
- Returns next action

**`tm autopilot status`**
```json
{
  "runId": "tdd-workflow-phase-0__task-1__2025-10-07T14-30-00-000Z",
  "taskId": "1",
  "currentSubtask": "1.2",
  "currentPhase": "green",
  "attemptNumber": 1,
  "progress": {
    "completed": ["1.1"],
    "current": "1.2",
    "remaining": ["1.3", "1.4"]
  },
  "commits": 1,
  "startTime": "2025-10-07T14:30:00Z",
  "duration": "5m 30s"
}
```

### 10. MCP Tools for AI Agent Orchestration

**New MCP tools** (add to `packages/tm-mcp/src/tools/`):

```typescript
// autopilot_start
{
  name: "autopilot_start",
  description: "Start autonomous TDD workflow for a task",
  parameters: {
    taskId: string,
    options?: {
      branch?: string,
      maxAttempts?: number
    }
  },
  returns: {
    runId: string,
    branch: string,
    nextAction: NextAction
  }
}

// autopilot_next
{
  name: "autopilot_next",
  description: "Get next action from workflow state",
  parameters: {
    projectRoot?: string  // defaults to current
  },
  returns: {
    action: "red" | "green" | "commit" | "complete",
    subtask: Subtask,
    context: Context,
    instructions: string
  }
}

// autopilot_complete_phase
{
  name: "autopilot_complete_phase",
  description: "Report test results and validate phase completion",
  parameters: {
    phase: "red" | "green",
    subtaskId: string,
    testResults: {
      passed: number,
      failed: number,
      skipped?: number
    },
    coverage?: number,  // Optional coverage percentage
    files?: string[]    // Optional, auto-detected if not provided
  },
  returns: {
    validated: boolean,
    message: string,
    suggestion?: string,
    nextAction: NextAction
  }
}

// autopilot_commit
{
  name: "autopilot_commit",
  description: "Create commit for completed subtask",
  parameters: {
    subtaskId: string,
    files?: string[],
    message?: string  // Override
  },
  returns: {
    commitSha: string,
    message: string,
    nextAction: NextAction
  }
}

// autopilot_status
{
  name: "autopilot_status",
  description: "Get current workflow status",
  parameters: {
    projectRoot?: string
  },
  returns: {
    runId: string,
    taskId: string,
    currentSubtask: string,
    currentPhase: string,
    progress: Progress,
    commits: number
  }
}

// autopilot_resume
{
  name: "autopilot_resume",
  description: "Resume interrupted workflow",
  parameters: {
    runId?: string  // defaults to current
  },
  returns: {
    resumed: boolean,
    nextAction: NextAction
  }
}
```

**MCP tool usage example (Claude Code session):**

```javascript
// AI agent calls MCP tools
const { runId, nextAction } = await mcp.autopilot_start({ taskId: "1" })

while (nextAction.action !== "complete") {
  const action = await mcp.autopilot_next()

  if (action.action === "red") {
    // AI generates tests
    const tests = await generateTests(action.subtask, action.context)
    await writeFiles(tests)

    // AI runs tests (using project's test command)
    const testOutput = await runCommand("npm test")  // or pytest, go test, etc.
    const results = parseTestOutput(testOutput)

    // Report results to TaskMaster
    const validation = await mcp.autopilot_complete_phase({
      phase: "red",
      subtaskId: action.subtask.id,
      testResults: {
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped
      }
    })

    if (!validation.validated) {
      console.error(validation.message)
      // Handle validation failure
    }
  }

  if (action.action === "green") {
    // AI implements code
    const impl = await implementCode(action.subtask, action.context)
    await writeFiles(impl)

    // AI runs tests again
    const testOutput = await runCommand("npm test")
    const results = parseTestOutput(testOutput)
    const coverage = parseCoverage(testOutput)

    // Report results to TaskMaster
    const validation = await mcp.autopilot_complete_phase({
      phase: "green",
      subtaskId: action.subtask.id,
      testResults: {
        passed: results.passed,
        failed: results.failed
      },
      coverage: coverage.lines
    })

    if (!validation.validated) {
      console.log(validation.message, validation.suggestion)
      // Retry or handle failure
    }
  }

  if (action.action === "commit") {
    // TaskMaster creates the commit
    const { commitSha, nextAction: next } = await mcp.autopilot_commit({
      subtaskId: action.subtask.id
    })

    nextAction = next
  }
}
```

### 11. AI Agent Instructions (CLAUDE.md integration)

Add to `.claude/CLAUDE.md` or `.cursor/rules/`:

````markdown
## TaskMaster Autonomous Workflow

When working on tasks with `tm autopilot`:

1. **Start workflow:**
   ```bash
   tm autopilot start <taskId>
   ```

2. **Loop until complete:**
   ```bash
   # Get next action
   NEXT=$(tm autopilot next --json)
   ACTION=$(echo $NEXT | jq -r '.action')
   SUBTASK=$(echo $NEXT | jq -r '.subtask.id')

   case $ACTION in
     red)
       # 1. Generate tests based on instructions
       # 2. Write test files
       # 3. Run tests yourself (you know the test command)
       npm test  # or pytest, go test, cargo test, etc.

       # 4. Report results to TaskMaster
       tm autopilot complete red $SUBTASK --results="failed:3,passed:0"
       ;;

     green)
       # 1. Implement code to pass tests
       # 2. Write implementation files
       # 3. Run tests yourself
       npm test

       # 4. Report results to TaskMaster (include coverage if available)
       tm autopilot complete green $SUBTASK --results="passed:3,failed:0" --coverage="92"
       ;;

     commit)
       # TaskMaster handles git operations
       tm autopilot commit $SUBTASK
       ;;

     complete)
       echo "Workflow complete!"
       ;;
   esac
   ```

3. **State is preserved** - you can stop/resume anytime with `tm autopilot resume`

**Important:** You are responsible for:
- Running test commands (TaskMaster doesn't know your test framework)
- Parsing test output (passed/failed counts)
- Reporting accurate results

**Via MCP:**
Use `autopilot_*` tools for the same workflow with better integration.
````

**Example AI agent prompt:**

```markdown
You are working autonomously on Task Master tasks using the autopilot workflow.

Instructions:
1. Call `tm autopilot next --json` to get your next action
2. Read the action type and context
3. Execute the action:
   - **RED**:
     * Generate tests that fail initially
     * Run tests: `npm test` (or appropriate test command)
     * Report: `tm autopilot complete red <id> --results="failed:n,passed:n"`
   - **GREEN**:
     * Implement code to pass the tests
     * Run tests: `npm test`
     * Report: `tm autopilot complete green <id> --results="passed:n,failed:n" --coverage="nn"`
   - **COMMIT**:
     * Call: `tm autopilot commit <id>` (TaskMaster handles git)
4. Repeat until action is "complete"

Always:
- Follow TDD principles (RED → GREEN → COMMIT)
- YOU run the tests (TaskMaster doesn't know test frameworks)
- Report accurate test results (passed/failed counts)
- Write minimal code to pass tests
- Check `tm autopilot status` if unsure of current state

You are responsible for:
- Knowing which test command to run (npm test, pytest, go test, etc.)
- Parsing test output to get pass/fail counts
- Understanding the project's testing framework
- Running tests after generating/implementing code

TaskMaster is responsible for:
- Validating your reported results make sense (RED should fail, GREEN should pass)
- Creating properly formatted git commits
- Managing workflow state and transitions
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

**Add to `.taskmaster/config.json` (versioned):**
```json
{
  "autopilot": {
    "enabled": true,
    "requireCleanWorkingTree": true,
    "commitTemplate": "{type}({scope}): {msg} (task {taskId})",
    "defaultCommitType": "feat",
    "maxGreenAttempts": 3,
    "testTimeout": 300000,
    "storage": {
      "location": "global",
      "basePath": "~/.taskmaster"
    }
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

**Update `.gitignore` (keep project clean):**
```gitignore
# TaskMaster runtime artifacts (stored globally, not needed in repo)
.taskmaster/state/
.taskmaster/reports/

# Keep these versioned
!.taskmaster/tasks/
!.taskmaster/config.json
!.taskmaster/docs/
!.taskmaster/templates/
```

## Out of Scope (defer to Phase 2)
- PR creation (gh integration)
- Resume functionality (`--resume` flag)
- Lint/format step
- Multiple executor support (only Claude)

## Implementation Order

### Phase 1A: Infrastructure (Week 1)
1. Global storage utilities (path normalization, run ID generation)
2. Activity log writer (append-only JSONL)
3. State manager (load/save/update state.json)
4. GitAdapter with safety checks
5. TestResultValidator (validate RED/GREEN phase results)

### Phase 1B: Orchestration Core (Week 1-2)
6. WorkflowOrchestrator state machine skeleton
7. State transitions (Preflight → BranchSetup → SubtaskLoop → Finalize)
8. Event emitter for activity logging
9. Enhanced commit message generator

### Phase 1C: TDD Loop (Week 2)
10. RED phase validator (ensure tests fail)
11. GREEN phase validator (ensure tests pass)
12. COMMIT phase implementation (staging, committing)
13. Subtask progression logic

### Phase 1D: CLI Interface (Week 2-3)
14. `tm autopilot start` command
15. `tm autopilot next` command
16. `tm autopilot complete` command
17. `tm autopilot commit` command
18. `tm autopilot status` command
19. `tm autopilot resume` command

### Phase 1E: MCP Interface (Week 3)
20. `autopilot_start` tool
21. `autopilot_next` tool
22. `autopilot_complete_phase` tool
23. `autopilot_commit` tool
24. `autopilot_status` tool
25. `autopilot_resume` tool

### Phase 1F: Integration (Week 3)
26. AI agent instruction templates
27. Error handling and recovery
28. Integration tests
29. Documentation

## Testing Strategy
- Unit tests for global storage (path normalization, state management)
- Unit tests for activity log (JSONL append, parsing)
- Unit tests for each adapter (mock git/test commands)
- Integration tests with real git repo (temporary directory)
- End-to-end test with sample task in test project
- Verify no commits on default branch (security test)
- Verify commit gating works (force test failure, ensure no commit)
- Verify enhanced commit messages include task context
- Test resume from state checkpoint
- Verify project directory stays clean (no runtime artifacts)

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
- Verify global storage created in `~/.taskmaster/projects/<project>/`
- Verify activity log is valid JSONL and streamable
- Verify state.json allows resumption
- Verify commit messages include task metadata
- Verify project directory contains no runtime artifacts after run
- Test with multiple worktrees (independent state per worktree)
