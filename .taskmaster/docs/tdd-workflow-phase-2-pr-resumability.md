# Phase 2: PR + Resumability - Autonomous TDD Workflow

## Objective
Add PR creation with GitHub CLI integration, resumable checkpoints for interrupted runs, and enhanced guardrails with coverage enforcement.

## Scope
- GitHub PR creation via `gh` CLI
- Well-formed PR body using run report
- Resumable checkpoints and `--resume` flag
- Coverage enforcement before finalization
- Optional lint/format step
- Enhanced error recovery

## Deliverables

### 1. PR Creation Integration

**PRAdapter** (`packages/tm-core/src/services/pr-adapter.ts`):
```typescript
class PRAdapter {
  async isGHAvailable(): Promise<boolean>
  async createPR(options: PROptions): Promise<PRResult>
  async getPRTemplate(runReport: RunReport): Promise<string>

  // Fallback for missing gh CLI
  async getManualPRInstructions(options: PROptions): Promise<string>
}

interface PROptions {
  branch: string
  base: string
  title: string
  body: string
  draft?: boolean
}

interface PRResult {
  url: string
  number: number
}
```

**PR Title Format:**
```
Task #<id> [<tag>]: <title>
```

Example: `Task #42 [analytics]: User metrics tracking`

**PR Body Template:**

Located at `.taskmaster/templates/pr-body.md`:

```markdown
## Summary

Implements Task #42 from TaskMaster autonomous workflow.

**Branch:** {branch}
**Tag:** {tag}
**Subtasks completed:** {subtaskCount}

{taskDescription}

## Subtasks

{subtasksList}

## Test Coverage

| Metric | Coverage |
|--------|----------|
| Lines | {lines}% |
| Branches | {branches}% |
| Functions | {functions}% |
| Statements | {statements}% |

**All subtasks passed with {totalTests} tests.**

## Commits

{commitsList}

## Run Report

Full execution report: `.taskmaster/reports/runs/{runId}/`

---

🤖 Generated with [Task Master](https://github.com/cline/task-master) autonomous TDD workflow
```

**Token replacement:**
- `{branch}` → branch name
- `{tag}` → active tag
- `{subtaskCount}` → number of completed subtasks
- `{taskDescription}` → task description from TaskMaster
- `{subtasksList}` → markdown list of subtask titles
- `{lines}`, `{branches}`, `{functions}`, `{statements}` → coverage percentages
- `{totalTests}` → total test count
- `{commitsList}` → markdown list of commit SHAs and messages
- `{runId}` → run ID timestamp

### 2. GitHub CLI Integration

**Detection:**
```bash
which gh
```

If not found, show fallback instructions:
```bash
✓ Branch pushed: analytics/task-42-user-metrics
✗ gh CLI not found - cannot create PR automatically

To create PR manually:
  gh pr create \
    --base main \
    --head analytics/task-42-user-metrics \
    --title "Task #42 [analytics]: User metrics tracking" \
    --body-file .taskmaster/reports/runs/2025-01-15-142033/pr.md

Or visit:
  https://github.com/org/repo/compare/main...analytics/task-42-user-metrics
```

**Confirmation gate:**
```bash
Ready to create PR:
  Title: Task #42 [analytics]: User metrics tracking
  Base: main
  Head: analytics/task-42-user-metrics

Create PR? [Y/n]
```

Unless `--no-confirm` flag is set.

### 3. Resumable Workflow

**State Checkpoint** (`state.json`):
```json
{
  "runId": "2025-01-15-142033",
  "taskId": "42",
  "phase": "subtask-loop",
  "currentSubtask": "42.2",
  "currentPhase": "green",
  "attempts": 2,
  "completedSubtasks": ["42.1"],
  "commits": ["a1b2c3d"],
  "branch": "analytics/task-42-user-metrics",
  "tag": "analytics",
  "canResume": true,
  "pausedAt": "2025-01-15T14:25:35Z",
  "pausedReason": "max_attempts_reached",
  "nextAction": "manual_review_required"
}
```

**Resume Command:**
```bash
$ tm autopilot --resume

Resuming run: 2025-01-15-142033
  Task: #42 [analytics] User metrics tracking
  Branch: analytics/task-42-user-metrics
  Last subtask: 42.2 (GREEN phase, attempt 2/3 failed)
  Paused: 5 minutes ago

Reason: Could not achieve green state after 3 attempts
Last error: POST /api/metrics returns 500 instead of 201

Resume from subtask 42.2 GREEN phase? [Y/n]
```

**Resume logic:**
1. Load state from `.taskmaster/reports/runs/<runId>/state.json`
2. Verify branch still exists and is checked out
3. Verify no uncommitted changes (unless `--force`)
4. Continue from last checkpoint phase
5. Update state file as execution progresses

**Multiple interrupted runs:**
```bash
$ tm autopilot --resume

Found 2 resumable runs:
  1. 2025-01-15-142033 - Task #42 (paused 5 min ago at subtask 42.2 GREEN)
  2. 2025-01-14-103022 - Task #38 (paused 2 hours ago at subtask 38.3 RED)

Select run to resume [1-2]:
```

### 4. Coverage Enforcement

**Coverage Check Phase** (before finalization):
```typescript
async function enforceCoverage(runId: string): Promise<void> {
  const testResults = await testRunner.runAll()
  const coverage = await testRunner.getCoverage()

  const thresholds = config.test.coverageThresholds
  const failures = []

  if (coverage.lines < thresholds.lines) {
    failures.push(`Lines: ${coverage.lines}% < ${thresholds.lines}%`)
  }
  // ... check branches, functions, statements

  if (failures.length > 0) {
    throw new CoverageError(
      `Coverage thresholds not met:\n${failures.join('\n')}`
    )
  }

  // Store coverage in run report
  await storeRunArtifact(runId, 'coverage.json', coverage)
}
```

**Handling coverage failures:**
```bash
⚠️  Coverage check failed:
  Lines: 78.5% < 80%
  Branches: 75.0% < 80%

Options:
  1. Add more tests and resume
  2. Lower thresholds in .taskmaster/config.json
  3. Skip coverage check: tm autopilot --resume --skip-coverage

Run paused. Fix coverage and resume with:
  tm autopilot --resume
```

### 5. Optional Lint/Format Step

**Configuration:**
```json
{
  "autopilot": {
    "finalization": {
      "lint": {
        "enabled": true,
        "command": "npm run lint",
        "fix": true,
        "failOnError": false
      },
      "format": {
        "enabled": true,
        "command": "npm run format",
        "commitChanges": true
      }
    }
  }
}
```

**Execution:**
```bash
Finalization Steps:

  ✓ All tests passing (12 tests, 0 failures)
  ✓ Coverage thresholds met (85% lines, 82% branches)

  LINT Running linter... ⏳
  LINT ✓ No lint errors

  FORMAT Running formatter... ⏳
  FORMAT ✓ Formatted 3 files
  FORMAT ✓ Committed formatting changes: "chore: auto-format code"

  PUSH Pushing to origin... ⏳
  PUSH ✓ Pushed analytics/task-42-user-metrics

  PR Creating pull request... ⏳
  PR ✓ Created PR #123
      https://github.com/org/repo/pull/123
```

### 6. Enhanced Error Recovery

**Pause Points:**
- Max GREEN attempts reached (current)
- Coverage check failed (new)
- Lint errors (if `failOnError: true`)
- Git push failed (new)
- PR creation failed (new)

**Each pause saves:**
- Full state checkpoint
- Last command output
- Suggested next actions
- Resume instructions

**Automatic recovery attempts:**
- Git push: retry up to 3 times with backoff
- PR creation: fall back to manual instructions
- Lint: auto-fix if enabled, otherwise pause

### 7. Finalization Phase Enhancement

**Updated workflow:**
1. Run full test suite
2. Check coverage thresholds → pause if failed
3. Run lint (if enabled) → pause if failed and `failOnError: true`
4. Run format (if enabled) → auto-commit changes
5. Confirm push (unless `--no-confirm`)
6. Push branch → retry on failure
7. Generate PR body from template
8. Create PR via gh → fall back to manual instructions
9. Update task status to 'review' (configurable)
10. Save final run report

**Final output:**
```bash
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Task #42 [analytics]: User metrics tracking - COMPLETE

  Branch: analytics/task-42-user-metrics
  Subtasks completed: 3/3
  Commits: 3
  Total tests: 12 (12 passed, 0 failed)
  Coverage: 85% lines, 82% branches, 88% functions, 85% statements

  PR #123: https://github.com/org/repo/pull/123

  Run report: .taskmaster/reports/runs/2025-01-15-142033/

Next steps:
  - Review PR and request changes if needed
  - Merge when ready
  - Task status updated to 'review'

Completed in 24 minutes
```

## CLI Updates

**New flags:**
- `--resume` → Resume from last checkpoint
- `--skip-coverage` → Skip coverage checks
- `--skip-lint` → Skip lint step
- `--skip-format` → Skip format step
- `--skip-pr` → Push branch but don't create PR
- `--draft-pr` → Create draft PR instead of ready-for-review

## Configuration Updates

**Add to `.taskmaster/config.json`:**
```json
{
  "autopilot": {
    "finalization": {
      "lint": {
        "enabled": false,
        "command": "npm run lint",
        "fix": true,
        "failOnError": false
      },
      "format": {
        "enabled": false,
        "command": "npm run format",
        "commitChanges": true
      },
      "updateTaskStatus": "review"
    }
  },
  "git": {
    "pr": {
      "enabled": true,
      "base": "default",
      "bodyTemplate": ".taskmaster/templates/pr-body.md",
      "draft": false
    },
    "pushRetries": 3,
    "pushRetryDelay": 5000
  }
}
```

## Success Criteria
- Can create PR automatically with well-formed body
- Can resume interrupted runs from any checkpoint
- Coverage checks prevent low-quality code from being merged
- Clear error messages and recovery paths for all failure modes
- Run reports include full PR context for review

## Out of Scope (defer to Phase 3)
- Multiple test framework support (pytest, go test)
- Diff preview before commits
- TUI panel implementation
- Extension/IDE integration

## Testing Strategy
- Mock `gh` CLI for PR creation tests
- Test resume from each possible pause point
- Test coverage failure scenarios
- Test lint/format integration with mock commands
- End-to-end test with PR creation on test repo

## Dependencies
- Phase 1 completed (core workflow)
- GitHub CLI (`gh`) installed (optional, fallback provided)
- Test framework supports coverage output

## Estimated Effort
1-2 weeks

## Risks & Mitigations
- **Risk:** GitHub CLI auth issues
  - **Mitigation:** Clear auth setup docs, fallback to manual instructions

- **Risk:** PR body template doesn't match all project needs
  - **Mitigation:** Make template customizable via config path

- **Risk:** Resume state gets corrupted
  - **Mitigation:** Validate state on load, provide --force-reset option

- **Risk:** Coverage calculation differs between runs
  - **Mitigation:** Store coverage with each test run for comparison

## Validation
Test with:
- Successful PR creation end-to-end
- Resume from GREEN attempt failure
- Resume from coverage failure
- Resume from lint failure
- Missing `gh` CLI (fallback to manual)
- Lint/format integration enabled
- Multiple interrupted runs (selection UI)
