---
created: 2026-01-05
status: DRAFT
source_decisions: thoughts/shared/exploration/2025-01-05_task-master-next-concurrency.md
source_exploration: thoughts/shared/exploration/2025-01-05_task-master-next-concurrency.md
task_ready: true
estimated_complexity: medium
code_paths:
  - packages/tm-core/src/modules/tasks/services/task-service.ts
  - apps/cli/src/commands/next.command.ts
---

# PRD: Concurrency Parameter for "task-master next"

## 1. Executive Summary

**Problem Statement:**
The current "task-master next" command only returns a single task at a time. Development teams and solo developers managing concurrent workstreams need to retrieve multiple ready-to-work tasks simultaneously to improve workflow efficiency.

**Solution Overview:**
Add a `--concurrency` parameter to the "task-master next" CLI command that returns up to N independent tasks (default: 1, with flag default: 2). The feature uses an array-based selection algorithm with inter-task dependency checking, ensuring all returned tasks have completed dependencies and are not dependent on each other.

**Success Definition:**
- Users can retrieve multiple tasks with a single CLI command
- All returned tasks are independently workable (no cross-dependencies)
- Backwards compatibility is preserved for single-task usage
- Performance remains acceptable for typical projects (< 100 tasks)
- Feature is CLI-only for v1 (MCP support deferred)

## 2. Goals & Non-Goals

### Goals

- [G-001] Enable users to retrieve multiple independent tasks via `--concurrency` flag
- [G-002] Maintain backwards compatibility for existing single-task behavior
- [G-003] Ensure all returned tasks have satisfied dependencies
- [G-004] Ensure no returned task depends on any other returned task
- [G-005] Respect existing priority-based sorting (critical → high → medium → low)
- [G-006] Provide clear CLI output for multiple tasks
- [G-007] Support JSON output format for programmatic consumption
- [G-008] Include comprehensive unit and integration tests

### Non-Goals

- [NG-001] MCP tool implementation (deferred to future phase)
- [NG-002] Task reservation/locking for multi-user scenarios
- [NG-003] Advanced dependency graph visualization or critical path analysis
- [NG-004] Task shuffling or load balancing algorithms
- [NG-005] Performance optimization for >100 task projects (O(n²) is acceptable for v1)

## 3. Target Users & Stakeholders

### Primary Users

- **Development Teams**: Multiple developers working in parallel on the same project
- **Solo Developers**: Managing multiple concurrent workstreams or context-switching between features
- **Project Managers**: Planning and allocating parallel work

### Secondary Users

- **CI/CD Pipelines**: Automated task queueing and distribution
- **Tool Integrators**: JSON consumers building custom workflows

### Stakeholder Needs

- **Predictability**: Users should understand which tasks are selected and why
- **Transparency**: Clear indication of how many tasks were requested vs returned
- **Reliability**: No breaking changes to existing workflows or JSON consumers
- **Performance**: Sub-second response time for typical project sizes

## 4. Functional Requirements

Each requirement is atomic and testable.

### Core API (tm-core)

**[FR-001] Add new method to TaskService**
Add `getNextTasks(concurrency: number, tag?: string): Promise<Task[]>` method to `TaskService` class.
- Acceptance Criteria:
  - Method exists in `packages/tm-core/src/modules/tasks/services/task-service.ts`
  - Returns `Promise<Task[]>`
  - Throws error if `concurrency < 1`
  - Existing `getNextTask()` method remains unchanged

**[FR-002] Implement concurrent task selection algorithm**
The `getNextTasks()` method must select up to `concurrency` independent tasks.
- Acceptance Criteria:
  - Returns empty array when no eligible tasks exist
  - Returns fewer tasks than requested if insufficient eligible tasks (no warning)
  - All returned tasks have status `pending` or `in-progress`
  - All returned tasks have satisfied dependencies
  - No returned task depends on any other returned task
  - Tasks are sorted by priority (critical → high → medium → low), then dependency count, then ID
  - Maintains two-phase selection: subtasks from in-progress parents first, then top-level tasks

**[FR-003] Validate concurrency parameter**
The method must validate the concurrency parameter.
- Acceptance Criteria:
  - Throws error with clear message if `concurrency < 1`
  - Throws error with clear message if `concurrency` is not a number
  - Caps internally at 10 (returns warning if > 10 requested, but clamps to 10)
  - Never attempts to return more tasks than exist in the eligible pool

**[FR-004] Handle mixed task/subtask dependencies**
The selection algorithm must handle dependencies between tasks and subtasks.
- Acceptance Criteria:
  - Correctly handles task dependencies (e.g., Task 3 depends on Task 1)
  - Correctly handles subtask dependencies (e.g., Subtask 1.2 depends on Subtask 1.1)
  - Correctly handles cross-type dependencies (e.g., Task 3 depends on Subtask 1.2)
  - Normalizes all dependency IDs to full dotted notation for comparison

### CLI Interface

**[FR-005] Add --concurrency flag to NextCommand**
Add `--concurrency <number>` flag to the CLI command.
- Acceptance Criteria:
  - Flag is optional
  - Default value is 1 when flag not present
  - Requires explicit value (e.g., `--concurrency 3`)
  - Flag is documented in command help text
  - Validation error shown if value < 1 or non-numeric
  - Warning shown if value > 10 (clamped to 10)

**[FR-006] Update NextCommand to call new core method**
Modify the CLI command to use `getNextTasks()` when concurrency is specified.
- Acceptance Criteria:
  - Calls `tmCore.tasks.getNext()` when concurrency = 1 (existing behavior)
  - Calls `tmCore.tasks.getNextTasks(concurrency, tag)` when concurrency > 1
  - Passes tag parameter correctly to both methods

**[FR-007] Update NextTaskResult interface**
Modify the result type to support both single and multiple tasks.
- Acceptance Criteria:
  - Interface retains `task: Task | null` field for backwards compatibility
  - Interface adds `tasks: Task[]` field
  - Interface adds `taskCount: number` field indicating count returned
  - Both `task` and `tasks` fields are populated when results exist
  - `found` boolean is `true` when at least one task returned

**[FR-008] Display multiple tasks in text format**
The CLI must display multiple tasks clearly when using text output.
- Acceptance Criteria:
  - Shows header indicating how many tasks found (e.g., "Found 3 ready tasks:")
  - Displays each task sequentially using existing `displayTaskDetails` component
  - Separator line between tasks for visual clarity
  - Numbered headers for each task (e.g., "Task 1 of 3: #5 - Implement auth")
  - Maintains existing header, storage type, and tag information

**[FR-009] Support JSON output for multiple tasks**
The CLI must return valid JSON when using `--format json`.
- Acceptance Criteria:
  - JSON object contains: `{ task, tasks, found, taskCount, tag, storageType, hasAnyTasks }`
  - `task` field contains first task or `null`
  - `tasks` field contains array of all tasks (empty if none)
  - `taskCount` is length of tasks array
  - `found` is `true` when taskCount > 0
  - Backwards compatible with existing JSON consumers

**[FR-010] Handle edge cases gracefully**
The CLI must handle various edge cases without crashing.
- Acceptance Criteria:
  - Returns 0 tasks when no tasks exist in project
  - Returns fewer tasks than requested without error when insufficient eligible tasks
  - Shows "No tasks available" message when eligible task count is 0
  - Handles projects with only completed tasks
  - Handles projects where all pending tasks have unsatisfied dependencies

## 5. Non-Functional Requirements

### Performance

- [NFR-001] Response time must be < 500ms for projects with < 100 tasks
- [NFR-002] Memory usage must not increase significantly with concurrency parameter
- [NFR-003] O(n²) dependency checking is acceptable for v1 (optimization deferred)

### Maintainability

- [NFR-004] Code must follow existing patterns in `task-service.ts`
- [NFR-005] Minimal refactoring of existing `getNextTask()` method
- [NFR-006] Clear separation between single-task and multi-task code paths

### Compatibility

- [NFR-007] Must not break existing CLI scripts that call `task-master next`
- [NFR-008] Must not break existing JSON consumers
- [NFR-009] Must support all existing flags: `--tag`, `--format`, `--silent`, `--project`

### Reliability

- [NFR-010] Zero tolerance for circular dependency crashes (already validated at load time)
- [NFR-011] Deterministic task selection (same inputs → same outputs)
- [NFR-012] No silent failures - all errors surfaced to user

## 6. Infrastructure & Deployment Behavior

### Environments

- No environment-specific configuration required
- Feature works identically across all deployment modes (local, CI, etc.)

### Dependencies

- No new npm packages allowed
- Must use existing dependencies: Commander, chalk, boxen

### Versioning

- Feature is additive (semver minor compatible)
- No breaking changes to existing APIs

## 7. Error Handling & Edge Cases

### Error Messages

**[EM-001] Invalid concurrency value**
```
Error: Invalid concurrency value: 'abc'. Concurrency must be a positive integer.
```

**[EM-002] Concurrency less than 1**
```
Error: Concurrency must be at least 1. Got: 0
```

**[EM-003] Concurrency exceeds maximum**
```
Warning: Concurrency capped at maximum of 10. Requested: 15, using: 10
```

### Edge Cases

**[EC-001] No tasks in project**
- Behavior: Show "No tasks found in this project" with tip to create tasks
- Return: `{ task: null, tasks: [], found: false, taskCount: 0 }`

**[EC-002] All tasks completed**
- Behavior: Show "All tasks are either completed, blocked by dependencies, or in progress"
- Return: `{ task: null, tasks: [], found: false, taskCount: 0 }`

**[EC-003] Fewer tasks than requested**
- Behavior: Return available tasks silently, no warning
- Example: Request 5, only 3 eligible → return 3 tasks
- Return: `{ task: Task, tasks: [Task, Task, Task], found: true, taskCount: 3 }`

**[EC-004] Single task requested with flag**
- Behavior: Return single task in both `task` and `tasks` fields
- Example: `--concurrency 1` → same as no flag
- Return: `{ task: Task, tasks: [Task], found: true, taskCount: 1 }`

**[EC-005] Complex dependency chains**
- Behavior: Select only tasks at the "frontier" of the dependency graph
- Example: If Task 3 depends on Task 1, and user requests 2 tasks, return Task 1 + another independent task
- Algorithm: Iteratively check each candidate against all already-selected tasks

**[EC-006] Subtasks from in-progress parents**
- Behavior: Maintain existing two-phase prioritization
- Example: If parent Task 5 is in-progress with eligible subtasks 5.1 and 5.2, these are considered before top-level tasks
- Rationale: Preserves existing workflow of continuing in-progress work

## 8. Acceptance Criteria (Global)

The implementation is "done" when:

1. **Core Implementation**
   - [ ] `getNextTasks()` method exists in `TaskService`
   - [ ] Algorithm correctly selects independent tasks up to concurrency limit
   - [ ] All dependency checks pass (both satisfied dependencies and inter-task independence)
   - [ ] Priority sorting is maintained

2. **CLI Implementation**
   - [ ] `--concurrency` flag works with explicit values
   - [ ] Default behavior (no flag) unchanged
   - [ ] Validation errors clear and actionable
   - [ ] Text output displays multiple tasks clearly
   - [ ] JSON output is backwards compatible

3. **Testing**
   - [ ] Unit tests for dependency checking between selected tasks
   - [ ] Unit tests for edge cases (0 tasks, 1 task, fewer than requested)
   - [ ] Integration tests with real task.json files
   - [ ] Tests for mixed task/subtask dependencies
   - [ ] Tests for complex dependency chains

4. **Documentation**
   - [ ] CLI help text updated
   - [ ] Code comments explain algorithm
   - [ ] PRD decisions traceable to implementation

5. **Quality Gates**
   - [ ] TypeScript type checking passes
   - [ ] All tests pass
   - [ ] No breaking changes to existing functionality
   - [ ] Performance acceptable for <100 task projects

## 9. Out-of-Scope / Deferred Work

Explicitly postponed to future phases:

- **MCP Tool**: `registerNextTaskTool` for MCP server integration (deferred to v2)
- **Task Reservation**: Multi-user task locking mechanism (deferred to v2)
- **Performance Optimization**: Topological sort for O(V+E) efficiency (deferred until profiling shows need)
- **Advanced Features**:
  - `--shuffle` flag for load balancing
  - `--critical-path` flag to show longest dependency chain
  - Task dependency graph visualization
  - Configurable max concurrency in config.json

## 10. Traceability

### Decision → Requirement Mapping

| Decision from Exploration | Implemented in PRD |
|---------------------------|-------------------|
| Option A: Array-based approach | FR-001, FR-002 |
| `--concurrency` flag with explicit value | FR-005 |
| Default to 1, flag requires value | FR-005, NFR-007 |
| Return fewer tasks silently | FR-002, EC-003 |
| Keep `task` field, add `tasks` array | FR-007, FR-009 |
| Sequential task cards display | FR-008 |
| Cap at 10 with warning | FR-003, EM-003 |
| Invalid values default to 1 with warning | FR-005, EM-001, EM-002 |
| MCP tool deferred | NG-001, Section 9 |
| Unit + integration tests | G-008, Section 8 |

### Risk Mitigation

| Risk from Exploration | Mitigation in PRD |
|----------------------|-------------------|
| Performance: O(n²) checks | NFR-001, NFR-003 - accepted for v1, optimized later |
| Breaking change for JSON consumers | FR-007, FR-009 - backwards compatible format |
| Complex dependency resolution | FR-004 - comprehensive handling of mixed dependencies |
| Subtask selection complexity | FR-002 - maintain two-phase behavior (EC-006) |

### Code Paths to Modify

**Core Changes:**
- `packages/tm-core/src/modules/tasks/services/task-service.ts`
  - Add `getNextTasks(concurrency: number, tag?: string)` method
  - Reuse existing helper functions (priority sorting, dependency checking)
  - No changes to `getNextTask()` method

**CLI Changes:**
- `apps/cli/src/commands/next.command.ts`
  - Update `NextCommandOptions` interface to include `concurrency?: number`
  - Add `.option('-c, --concurrency <number>', ...)` to command configuration
  - Update `executeCommand()` to handle concurrency parameter
  - Modify `displayResults()` to handle multiple tasks in text format
  - Update `NextTaskResult` interface to include `tasks` and `taskCount`

**Test Files:**
- `packages/tm-core/src/modules/tasks/services/task-service.spec.ts` (add tests)
- `apps/cli/src/commands/next.command.spec.ts` (update tests)
- Create integration test fixtures in `tests/integration/`

---

## Appendix: Algorithm Pseudocode

For reference, the high-level algorithm for `getNextTasks()`:

```
function getNextTasks(concurrency, tag):
    1. Validate concurrency (>= 1, <= 10)
    2. Get all tasks with filter { status: [pending, in-progress, done] }
    3. Build set of completed task/subtask IDs
    4. Collect eligible candidates:
       a. Subtasks from in-progress parents (with satisfied dependencies)
       b. Top-level tasks (with satisfied dependencies)
    5. Sort candidates by: priority (desc) → dep count (asc) → ID (asc)
    6. Select up to N tasks:
       selected = []
       for candidate in candidates:
           if selected.length >= concurrency: break
           if candidate not dependent on any task in selected:
               selected.append(candidate)
       return selected
```

This ensures:
- Priority order is maintained
- No selected task depends on another selected task
- All selected tasks have satisfied external dependencies
- Returns up to N tasks (fewer if dependencies block)
