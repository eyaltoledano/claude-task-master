# Phase 3: Extensibility + Guardrails - Autonomous TDD Workflow

## Objective
Add multi-language/framework support, enhanced safety guardrails, TUI interface, and extensibility for IDE/editor integration.

## Scope
- Multi-language test runner support (pytest, go test, etc.)
- Enhanced safety: diff preview, confirmation gates, minimal-change prompts
- Optional TUI panel with tmux integration
- State-based extension API for IDE integration
- Parallel subtask execution (experimental)

## Deliverables

### 1. Multi-Language Test Runner Support

**Extend TestRunnerAdapter:**
```typescript
class TestRunnerAdapter {
  // Existing methods...

  async detectLanguage(): Promise<Language>
  async detectFramework(language: Language): Promise<Framework>
  async getFrameworkAdapter(framework: Framework): Promise<FrameworkAdapter>
}

enum Language {
  JavaScript = 'javascript',
  TypeScript = 'typescript',
  Python = 'python',
  Go = 'go',
  Rust = 'rust'
}

enum Framework {
  Vitest = 'vitest',
  Jest = 'jest',
  Pytest = 'pytest',
  GoTest = 'gotest',
  CargoTest = 'cargotest'
}

interface FrameworkAdapter {
  runTargeted(pattern: string): Promise<TestResults>
  runAll(): Promise<TestResults>
  parseCoverage(output: string): Promise<CoverageReport>
  getTestFilePattern(): string
  getTestFileExtension(): string
}
```

**Framework-specific adapters:**

**PytestAdapter** (`packages/tm-core/src/services/test-adapters/pytest-adapter.ts`):
```typescript
class PytestAdapter implements FrameworkAdapter {
  async runTargeted(pattern: string): Promise<TestResults> {
    const output = await exec(`pytest ${pattern} --json-report`)
    return this.parseResults(output)
  }

  async runAll(): Promise<TestResults> {
    const output = await exec('pytest --cov --json-report')
    return this.parseResults(output)
  }

  parseCoverage(output: string): Promise<CoverageReport> {
    // Parse pytest-cov XML output
  }

  getTestFilePattern(): string {
    return '**/test_*.py'
  }

  getTestFileExtension(): string {
    return '.py'
  }
}
```

**GoTestAdapter** (`packages/tm-core/src/services/test-adapters/gotest-adapter.ts`):
```typescript
class GoTestAdapter implements FrameworkAdapter {
  async runTargeted(pattern: string): Promise<TestResults> {
    const output = await exec(`go test ${pattern} -json`)
    return this.parseResults(output)
  }

  async runAll(): Promise<TestResults> {
    const output = await exec('go test ./... -coverprofile=coverage.out -json')
    return this.parseResults(output)
  }

  parseCoverage(output: string): Promise<CoverageReport> {
    // Parse go test coverage output
  }

  getTestFilePattern(): string {
    return '**/*_test.go'
  }

  getTestFileExtension(): string {
    return '_test.go'
  }
}
```

**Detection Logic:**
```typescript
async function detectFramework(): Promise<Framework> {
  // Check for package.json
  if (await exists('package.json')) {
    const pkg = await readJSON('package.json')
    if (pkg.devDependencies?.vitest) return Framework.Vitest
    if (pkg.devDependencies?.jest) return Framework.Jest
  }

  // Check for Python files
  if (await exists('pytest.ini') || await exists('setup.py')) {
    return Framework.Pytest
  }

  // Check for Go files
  if (await exists('go.mod')) {
    return Framework.GoTest
  }

  // Check for Rust files
  if (await exists('Cargo.toml')) {
    return Framework.CargoTest
  }

  throw new Error('Could not detect test framework')
}
```

### 2. Enhanced Safety Guardrails

**Diff Preview Mode:**
```bash
$ tm autopilot 42 --preview-diffs

[2/3] Subtask 42.2: Add collection endpoint

  RED   ✓ Tests created: src/api/__tests__/metrics.test.js

  GREEN Implementing code...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Proposed changes (src/api/metrics.js):

  + import { MetricsSchema } from '../models/schema.js'
  +
  + export async function createMetric(data) {
  +   const validated = MetricsSchema.parse(data)
  +   const result = await db.metrics.create(validated)
  +   return result
  + }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply these changes? [Y/n/e(dit)/s(kip)]
  Y - Apply and continue
  n - Reject and retry GREEN phase
  e - Open in editor for manual changes
  s - Skip this subtask
```

**Minimal Change Enforcement:**

Add to system prompt:
```markdown
CRITICAL: Make MINIMAL changes to pass the failing tests.
- Only modify files directly related to the subtask
- Do not refactor existing code unless absolutely necessary
- Do not add features beyond the acceptance criteria
- Keep changes under 50 lines per file when possible
- Prefer composition over modification
```

**Change Size Warnings:**
```bash
⚠️  Large change detected:
  Files modified: 5
  Lines changed: +234, -12

This subtask was expected to be small (~50 lines).
Consider:
  - Breaking into smaller subtasks
  - Reviewing acceptance criteria
  - Checking for unintended changes

Continue anyway? [y/N]
```

### 3. TUI Interface with tmux

**Layout:**
```
┌──────────────────────────────────┬─────────────────────────────────┐
│ Task Navigator (left)            │ Executor Terminal (right)       │
│                                  │                                 │
│ Project: my-app                  │ $ tm autopilot --executor-mode  │
│ Branch: analytics/task-42        │ > Running subtask 42.2 GREEN... │
│ Tag: analytics                   │ > Implementing endpoint...      │
│                                  │ > Tests: 3 passed, 0 failed     │
│ Tasks:                           │ > Ready to commit               │
│ → 42 [in-progress] User metrics  │                                 │
│   → 42.1 [done] Schema           │ [Live output from executor]     │
│   → 42.2 [active] Endpoint ◀     │                                 │
│   → 42.3 [pending] Dashboard     │                                 │
│                                  │                                 │
│ [s] start  [p] pause  [q] quit   │                                 │
└──────────────────────────────────┴─────────────────────────────────┘
```

**Implementation:**

**TUI Navigator** (`apps/cli/src/ui/tui/navigator.ts`):
```typescript
import blessed from 'blessed'

class AutopilotTUI {
  private screen: blessed.Widgets.Screen
  private taskList: blessed.Widgets.ListElement
  private statusBox: blessed.Widgets.BoxElement
  private executorPane: string  // tmux pane ID

  async start(taskId?: string) {
    // Create blessed screen
    this.screen = blessed.screen()

    // Create task list widget
    this.taskList = blessed.list({
      label: 'Tasks',
      keys: true,
      vi: true,
      style: { selected: { bg: 'blue' } }
    })

    // Spawn tmux pane for executor
    this.executorPane = await this.spawnExecutorPane()

    // Watch state file for updates
    this.watchStateFile()

    // Handle keybindings
    this.setupKeybindings()
  }

  private async spawnExecutorPane(): Promise<string> {
    const paneId = await exec('tmux split-window -h -P -F "#{pane_id}"')
    await exec(`tmux send-keys -t ${paneId} "tm autopilot --executor-mode" Enter`)
    return paneId.trim()
  }

  private watchStateFile() {
    watch('.taskmaster/state/current-run.json', (event, filename) => {
      this.updateDisplay()
    })
  }

  private setupKeybindings() {
    this.screen.key(['s'], () => this.startTask())
    this.screen.key(['p'], () => this.pauseTask())
    this.screen.key(['q'], () => this.quit())
    this.screen.key(['up', 'down'], () => this.navigateTasks())
  }
}
```

**Executor Mode:**
```bash
$ tm autopilot 42 --executor-mode

# Runs in executor pane, writes state to shared file
# Left pane reads state file and updates display
```

**State File** (`.taskmaster/state/current-run.json`):
```json
{
  "runId": "2025-01-15-142033",
  "taskId": "42",
  "status": "running",
  "currentPhase": "green",
  "currentSubtask": "42.2",
  "lastOutput": "Implementing endpoint...",
  "testsStatus": {
    "passed": 3,
    "failed": 0
  }
}
```

### 4. Extension API for IDE Integration

**State-based API:**

Expose run state via JSON files that IDEs can read:
- `.taskmaster/state/current-run.json` - live run state
- `.taskmaster/reports/runs/<runId>/manifest.json` - run metadata
- `.taskmaster/reports/runs/<runId>/log.jsonl` - event stream

**WebSocket API (optional):**
```typescript
// packages/tm-core/src/services/autopilot-server.ts
class AutopilotServer {
  private wss: WebSocketServer

  start(port: number = 7890) {
    this.wss = new WebSocketServer({ port })

    this.wss.on('connection', (ws) => {
      // Send current state
      ws.send(JSON.stringify(this.getCurrentState()))

      // Stream events
      this.orchestrator.on('*', (event) => {
        ws.send(JSON.stringify(event))
      })
    })
  }
}
```

**Usage from IDE extension:**
```typescript
// VS Code extension example
const ws = new WebSocket('ws://localhost:7890')

ws.on('message', (data) => {
  const event = JSON.parse(data)

  if (event.type === 'subtask:complete') {
    vscode.window.showInformationMessage(
      `Subtask ${event.subtaskId} completed`
    )
  }
})
```

### 5. Parallel Subtask Execution (Experimental)

**Dependency Analysis:**
```typescript
class SubtaskScheduler {
  async buildDependencyGraph(subtasks: Subtask[]): Promise<DAG> {
    const graph = new DAG()

    for (const subtask of subtasks) {
      graph.addNode(subtask.id)

      for (const depId of subtask.dependencies) {
        graph.addEdge(depId, subtask.id)
      }
    }

    return graph
  }

  async getParallelBatches(graph: DAG): Promise<Subtask[][]> {
    const batches: Subtask[][] = []
    const completed = new Set<string>()

    while (completed.size < graph.size()) {
      const ready = graph.nodes.filter(node =>
        !completed.has(node.id) &&
        node.dependencies.every(dep => completed.has(dep))
      )

      batches.push(ready)
      ready.forEach(node => completed.add(node.id))
    }

    return batches
  }
}
```

**Parallel Execution:**
```bash
$ tm autopilot 42 --parallel

[Batch 1] Running 2 subtasks in parallel:
  → 42.1: Add metrics schema
  → 42.4: Add API documentation

  42.1 RED   ✓ Tests created
  42.4 RED   ✓ Tests created

  42.1 GREEN ✓ Implementation complete
  42.4 GREEN ✓ Implementation complete

  42.1 COMMIT ✓ Committed: a1b2c3d
  42.4 COMMIT ✓ Committed: e5f6g7h

[Batch 2] Running 2 subtasks in parallel (depend on 42.1):
  → 42.2: Add collection endpoint
  → 42.3: Add dashboard widget
  ...
```

**Conflict Detection:**
```typescript
async function detectConflicts(subtasks: Subtask[]): Promise<Conflict[]> {
  const conflicts: Conflict[] = []

  for (let i = 0; i < subtasks.length; i++) {
    for (let j = i + 1; j < subtasks.length; j++) {
      const filesA = await predictAffectedFiles(subtasks[i])
      const filesB = await predictAffectedFiles(subtasks[j])

      const overlap = filesA.filter(f => filesB.includes(f))

      if (overlap.length > 0) {
        conflicts.push({
          subtasks: [subtasks[i].id, subtasks[j].id],
          files: overlap
        })
      }
    }
  }

  return conflicts
}
```

### 6. Advanced Configuration

**Add to `.taskmaster/config.json`:**
```json
{
  "autopilot": {
    "safety": {
      "previewDiffs": false,
      "maxChangeLinesPerFile": 100,
      "warnOnLargeChanges": true,
      "requireConfirmOnLargeChanges": true
    },
    "parallel": {
      "enabled": false,
      "maxConcurrent": 3,
      "detectConflicts": true
    },
    "tui": {
      "enabled": false,
      "tmuxSession": "taskmaster-autopilot"
    },
    "api": {
      "enabled": false,
      "port": 7890,
      "allowRemote": false
    }
  },
  "test": {
    "frameworks": {
      "python": {
        "runner": "pytest",
        "coverageCommand": "pytest --cov",
        "testPattern": "**/test_*.py"
      },
      "go": {
        "runner": "go test",
        "coverageCommand": "go test ./... -coverprofile=coverage.out",
        "testPattern": "**/*_test.go"
      }
    }
  }
}
```

## CLI Updates

**New commands:**
```bash
tm autopilot <taskId> --tui              # Launch TUI interface
tm autopilot <taskId> --parallel         # Enable parallel execution
tm autopilot <taskId> --preview-diffs    # Show diffs before applying
tm autopilot <taskId> --executor-mode    # Run as executor pane
tm autopilot-server start                # Start WebSocket API
```

## Success Criteria
- Supports Python projects with pytest
- Supports Go projects with go test
- Diff preview prevents unwanted changes
- TUI provides better visibility for long-running tasks
- IDE extensions can integrate via state files or WebSocket
- Parallel execution reduces total time for independent subtasks

## Out of Scope
- Full Electron/web GUI
- AI executor selection UI (defer to Phase 4)
- Multi-repository support
- Remote execution on cloud runners

## Testing Strategy
- Test with Python project (pytest)
- Test with Go project (go test)
- Test diff preview UI with mock changes
- Test parallel execution with independent subtasks
- Test conflict detection with overlapping file changes
- Test TUI with mock tmux environment

## Dependencies
- Phase 2 completed (PR + resumability)
- tmux installed (for TUI)
- blessed or ink library (for TUI rendering)

## Estimated Effort
3-4 weeks

## Risks & Mitigations
- **Risk:** Parallel execution causes git conflicts
  - **Mitigation:** Conservative conflict detection, sequential fallback

- **Risk:** TUI adds complexity and maintenance burden
  - **Mitigation:** Keep TUI optional, state-based design allows alternatives

- **Risk:** Framework adapters hard to maintain across versions
  - **Mitigation:** Abstract common parsing logic, document adapter interface

- **Risk:** Diff preview slows down workflow
  - **Mitigation:** Make optional, use --preview-diffs flag only when needed

## Validation
Test with:
- Python project with pytest and pytest-cov
- Go project with go test
- Large changes requiring confirmation
- Parallel execution with 3+ independent subtasks
- TUI with task selection and live status updates
- VS Code extension reading state files
