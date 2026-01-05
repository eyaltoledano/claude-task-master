---
created: 2025-01-05
status: DECIDED
source: user-idea
decision: Option A - Array-Based Return with Inter-Task Dependency Checking
---

# Exploration: Concurrency Parameter for "task-master next"

## Problem Statement

**What problem are we trying to solve?**

The current "task-master next" command only returns a single task at a time. For teams or workflows where multiple developers can work in parallel, or for single developers managing multiple concurrent workstreams, users need to retrieve multiple ready-to-work tasks simultaneously.

**Why does it matter?**

- Improves workflow efficiency for parallel development scenarios
- Enables better task distribution across team members
- Reduces repeated "task-master next" calls when planning concurrent work
- Aligns with modern development practices where developers context-switch between tasks

**Who is affected?**

- Development teams using Task Master for project management
- Solo developers working on multiple independent features
- CI/CD pipelines that need to queue multiple tasks
- Project managers planning parallel work allocation

## Current State

**What exists today?**

The "task-master next" command is implemented in two layers:

1. **CLI Command**: `/apps/cli/src/commands/next.command.ts`
   - Thin presentation layer over `@tm/core`
   - Returns single `Task | null` from core
   - Supports options: `--tag`, `--format`, `--silent`, `--project`

2. **Core Logic**: `/packages/tm-core/src/modules/tasks/services/task-service.ts:299-418`
   - `getNextTask(tag?: string): Promise<Task | null>`
   - Two-phase selection algorithm:
     - Phase 1: Subtasks from in-progress parent tasks
     - Phase 2: Top-level pending tasks with satisfied dependencies
   - Sorting: Priority → dependency count → task ID

**Known constraints**

- No MCP tool exists for `next_task` (only autopilot-specific `next` tool)
- Current return type is single `Task | null`
- Dependency satisfaction checking is complex (both tasks and subtasks)
- Subtasks use dotted notation (e.g., "1.2", "1.2.3")

**Relevant code paths:**

- CLI command: `apps/cli/src/commands/next.command.ts:42-263`
- Core logic: `packages/tm-core/src/modules/tasks/services/task-service.ts:299-418`
- Dependency checking: `packages/tm-core/src/modules/tasks/services/task-service.ts:321-400`

## Design Options

### Option A: Array-Based Return with Inter-Task Dependency Checking

**Description:**

Modify `getNextTask()` to accept a `concurrency` parameter and return `Task[]`. The algorithm would:
1. Build list of all eligible tasks (existing logic)
2. Sort eligible tasks by priority
3. Iteratively select tasks, checking that each new task is not dependent on any already-selected task
4. Return up to `concurrency` tasks

**Pros:**

- Minimal changes to existing algorithm (build on top of current sorting)
- Clear, deterministic selection based on priority order
- Type-safe return (`Task[]` instead of `Task | null`)
- Preserves existing single-task behavior when `concurrency = 1`
- Easy to test dependency logic incrementally

**Cons:**

- Requires O(n²) dependency checking between selected tasks
- May return fewer tasks than requested if dependencies block
- Needs changes to CLI display logic to handle multiple tasks
- No MCP tool exists yet, so MCP support needs building from scratch

**Risks:**

- [Medium] Performance degradation with large task sets due to pairwise dependency checks
- [Low] Breaking change if CLI consumers parse JSON output expecting single task
- [Low] Complex dependency resolution if tasks have circular references (already validated elsewhere)

**Complexity:** Medium

**Assumptions:**
- Task dependency validation (circular refs) is already handled by `TaskLoaderService`
- Dependencies can reference both tasks and subtasks (e.g., "1", "1.2")

### Option B: Topological Sort with Batch Selection

**Description:**

Implement a topological sort of the dependency graph, then select the first N independent tasks from the "ready set" (tasks with no incoming edges from non-completed tasks).

**Pros:**

- More efficient O(V + E) dependency graph traversal
- Naturally handles complex dependency chains
- Returns truly parallelizable tasks (no dependencies between any selected tasks)
- Extensible for future features like "critical path" analysis
- Algorithmically cleaner for dependency-heavy projects

**Cons:**

- Significant algorithm changes from current implementation
- Requires building full dependency graph structure
- More complex to implement and test
- Overkill for projects with simple or no dependencies
- May change task ordering from existing priority-based sort

**Risks:**

- [High] Longer implementation time due to algorithm complexity
- [Medium] May introduce subtle bugs in edge cases (mixed task/subtask dependencies)
- [Medium] Potential performance regression for small projects due to graph construction overhead
- [Low] Different task selection order might confuse existing users

**Complexity:** High

**Assumptions:**
- Graph construction can handle mixed task/subtask dependencies efficiently
- Topological sort stability can maintain priority-based ordering within "ready set"

### Option C: Multi-Call Approach with State Tracking

**Description:**

Keep `getNextTask()` unchanged but add a new `getNextTasks(concurrency: number)` method. Internally, this would:
1. Call `getNextTask()` to get first task
2. Temporarily mark task as "reserved"
3. Call `getNextTask()` again (skipping reserved tasks)
4. Repeat until `concurrency` tasks found or no more eligible tasks
5. Return array of tasks

**Pros:**

- Zero changes to existing `getNextTask()` logic (backwards compatible)
- Isolated new method reduces risk of regressions
- Easy to reason about (reuse proven algorithm)
- Simpler testing (can mock existing method)
- Can reserve tasks to prevent race conditions in multi-user scenarios

**Cons:**

- Inefficient (multiple dependency checks on same task set)
- Requires temporary reservation mechanism (new state to manage)
- "Reservation" concept doesn't exist in current data model
- May conflict with actual task status updates during execution
- Still need O(n) calls to `getNextTask()`

**Risks:**

- [Medium] Performance worse than Option A for n > 1
- [Medium] State management complexity (reservation lifecycle, cleanup)
- [Low] Confusing UX if reserved tasks show up in "list" but not "next"

**Complexity:** Medium

**Assumptions:**
- Temporary reservation can be stored in-memory (doesn't persist to tasks.json)
- No concurrent processes will call `next` simultaneously (or race conditions are acceptable)

## Research Findings

**Source 1: Current implementation code analysis**

- Finding: The `getNextTask()` method uses two-phase selection (subtasks first, then top-level tasks), not a unified dependency graph traversal. Each phase independently builds candidate lists and sorts by priority.
- Location: `packages/tm-core/src/modules/tasks/services/task-service.ts:299-418`
- Assumption: This two-phase approach was designed to prioritize continuing in-progress work before starting new tasks.

**Source 2: Dependency validation implementation**

- Finding: Task dependency validation (including circular dependency detection) is already implemented in `TaskLoaderService.validateDependencies()` using depth-first search.
- Location: `packages/tm-core/src/modules/tasks/services/task-loader.service.ts:226-323`
- Assumption: When selecting concurrent tasks, we can assume all dependency references are valid (no circular deps) because validation happens at load time.

**Source 3: MCP tool architecture**

- Finding: There is NO general-purpose `next_task` MCP tool currently implemented. The only "next" tool is `registerAutopilotNextTool` which is specific to the autopilot TDD workflow.
- Location: `apps/mcp/src/tools/tasks/index.ts` (no next_task export)
- Assumption: A new MCP tool `registerNextTaskTool` will need to be created alongside CLI changes, or the feature is CLI-only initially.

**Source 4: Task entity structure**

- Finding: Tasks support `dependencies: string[]` array at both task and subtask level. Dependencies can reference task IDs ("1") or subtask IDs ("1.2" or just "2" within parent context).
- Location: `packages/tm-core/src/modules/tasks/entities/task.entity.ts:23, 49-50`
- Assumption: Dependency resolution needs to handle both formats and normalize to full dotted notation for comparison.

**Source 5: CLI return type usage**

- Finding: The CLI command returns `NextTaskResult` which wraps the task with metadata (`found`, `tag`, `storageType`, `hasAnyTasks`). The JSON output is `console.log(JSON.stringify(result, null, 2))`, so changing `task: Task | null` to `tasks: Task[]` is a breaking change for JSON consumers.
- Location: `apps/cli/src/commands/next.command.ts:30-36, 176-178`
- Assumption: Need to maintain backwards compatibility or document breaking change clearly for JSON API consumers.

## Constraints & Non-Negotiables

### Technical Constraints

- **Must preserve backwards compatibility** for single-task usage (`concurrency = 1` should behave identically to current behavior)
- **Must maintain dependency satisfaction** - all returned tasks must have their dependencies completed
- **Must handle mixed task/subtask dependencies** - e.g., Task 3 depends on Subtask 1.2
- **Must respect existing priority sorting** - higher priority tasks should be selected first
- **MCP tool tier limits** - if adding MCP tool, consider which tier (core/standard/all)

### Business Constraints

- **No external dependencies** - can't add new npm packages for this feature
- **Minimal refactoring** - should be additive changes, not architectural overhaul
- **Time-to-market** - simpler solutions preferred over algorithmically perfect ones

### Time Constraints

- **Implementation scope** - should be completable in a single work session
- **Testing overhead** - must have comprehensive tests for edge cases

### User Experience Considerations

- **Clear output format** - CLI must display multiple tasks cleanly (not just dump JSON)
- **Predictable behavior** - users should understand which tasks are selected and why
- **Error handling** - if fewer tasks available than requested, should still return what's available
- **Documentation** - feature should be discoverable and well-documented

## Open Questions

### Blocking Questions

- [ ] Should the `--concurrency` flag default to 1 when present (user explicitly wants concurrency but forgets value) or should it require a value (e.g., `--concurrency 3`)?
- [ ] What should happen when fewer tasks are available than requested? Return fewer silently, or show a warning?
- [ ] How should JSON output format change? `task: Task | null` → `tasks: Task[]` (breaking change) or add `tasks` alongside `task` (backwards compatible but awkward)?
- [ ] Should subtasks be eligible alongside top-level tasks in concurrent selection, or should we prefer selecting only top-level tasks when `concurrency > 1`?

### Non-Blocking Questions

- [ ] Should we add a `--shuffle` flag to randomize task selection for load balancing?
- [ ] Should there be a maximum limit on concurrency (e.g., cap at 10)?
- [ ] Should we add metadata to `NextTaskResult` like `requestedConcurrency` vs `returnedTaskCount`?
- [ ] How should this integrate with future multi-user features (task reservation/locking)?

## FINAL DECISION

**Decision:** Option A - Array-Based Return with Inter-Task Dependency Checking

**Rationale:**
- **Fastest to implement** - builds incrementally on existing algorithm without major refactoring
- **Performance is acceptable** - O(n²) dependency checking is negligible for typical projects (< 100 tasks)
- **Easiest to test and reason about** - clear selection logic, minimal state changes
- **Preserves existing behavior** - backwards compatible for `concurrency = 1`
- **Can optimize later** - if profiling shows issues with larger task sets

**Confidence level:** High

**Implementation Plan:**
1. Add `getNextTasks(concurrency: number, tag?: string)` method in `TaskService`
2. Add `--concurrency <number>` CLI flag to `NextCommand` (default: 1, with flag: 2)
3. Update `NextTaskResult` to support both single task and tasks array
4. Update CLI display logic to show multiple tasks cleanly
5. Add unit tests for inter-task dependency checking

## Blocking Questions - RESOLVED

- [x] **Should `--concurrency` flag default to 1 or require a value?**
  - **Decision**: Default to 1 when no flag, default to 2 when `--concurrency` is present without value, allow `--concurrency=N` for specific values

- [x] **What happens when fewer tasks are available than requested?**
  - **Decision**: Return fewer tasks silently (no warning). The command should be idempotent and predictable.

- [x] **How should JSON output format change?**
  - **Decision**: Keep `task: Task | null` for backwards compatibility, add `tasks: Task[]` for concurrent results. JSON consumers can check which field is populated.

- [x] **Should subtasks be eligible in concurrent selection?**
  - **Decision**: Yes - maintain existing two-phase behavior. If there are subtasks from in-progress parents, include them in the selection pool. This preserves the current workflow prioritization.
