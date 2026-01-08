# PRD: Task Master Loop (`tm loop`)

## Overview

**Task Master Loop** implements the "Ralph Wiggum" pattern (credited to Jeffrey Huntley, popularized by Matt Pocock) - a simple, loop-based approach to running coding agents that work through a task backlog one task at a time, with fresh context per iteration.

Unlike complex agent orchestration systems, Loop's power lies in its simplicity: a for loop that spawns a new agent session for each iteration, letting it pick the next task, complete it, commit, and exit. The fresh context window each iteration prevents context degradation and produces higher quality code.

## Problem Statement

Users currently run Task Master in two ways:

1. **Manual "next, next, next"** - Running `task-master next` repeatedly in the same session, which works but degrades context quality over time
2. **Autopilot TDD workflow** - A structured RED/GREEN/COMMIT cycle that's powerful but opinionated and complex for simple task completion

There's no middle ground: a simple loop that spawns fresh agent sessions, completes one task per iteration, and automatically stops when all tasks are done.

## Goals

1. **Simple loop execution** - Run Claude Code in a loop, one task per iteration, fresh context each time
2. **Automatic task selection** - Use `task-master next` or intelligent task selection to pick what to work on
3. **Clear completion criteria** - Stop when all tasks are done (or max iterations reached)
4. **Progress tracking** - Maintain a progress log across iterations for agent memory
5. **Built-in presets** - Provide ready-to-use workflow presets (test coverage, linting, duplication, entropy)
6. **Custom prompts** - Allow users to provide custom prompt files for domain-specific workflows

## Non-Goals

- Replacing the existing autopilot TDD workflow
- Complex agent orchestration or multi-agent coordination
- Real-time human-in-the-loop interaction (that's what manual `next` is for)
- Multi-agent support (v2 consideration: codex, aider, etc.)
- Programmatic enforcement of quality gates (the prompt is the source of truth - modern models follow instructions)

## User Stories

### US-1: Basic Loop

As a developer, I want to run `task-master loop --iterations 10` and have it automatically work through my pending tasks, one per iteration, stopping when all tasks are done or iterations exhausted.

### US-2: Preset Workflows

As a developer, I want to use built-in presets (`--prompt test-coverage`, `--prompt linting`, etc.) for common workflows without writing custom prompts.

### US-3: Custom Prompts

As a developer, I want to provide a custom prompt file (`--prompt ./my-prompt.md`) for domain-specific workflows not covered by presets.

### US-4: Progress Persistence

As a developer, I want the loop to maintain a progress.txt file that persists learnings across iterations, so each fresh agent session has context about what was already done.

### US-5: Completion Notification

As a developer, I want the loop to notify me when complete (stdout message, optional webhook/command).

## Technical Design

### Architecture

Loop will be implemented as:

1. **CLI Command** (`apps/cli/src/commands/loop.command.ts`) - Thin presentation layer
2. **Core Logic** (`packages/tm-core/src/modules/loop/`) - Business logic for task selection, progress tracking, prompt generation, preset resolution

### Command Interface

```bash
# Basic usage - run up to 10 iterations with default preset
task-master loop --iterations 10

# Built-in presets
task-master loop -n 10 --prompt test-coverage   # Write tests for uncovered code
task-master loop -n 10 --prompt linting         # Fix lint/type errors
task-master loop -n 10 --prompt duplication     # Refactor duplicated code
task-master loop -n 10 --prompt entropy         # Clean up code smells

# Custom prompt file (detected by path-like string or file extension)
task-master loop -n 10 --prompt .taskmaster/prompts/my-workflow.md

# With completion command (runs when done)
task-master loop -n 10 --on-complete "notify-send 'Loop complete'"

# Filter by tag
task-master loop -n 5 --tag backend
```

### Options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `--iterations, -n` | number | 10 | Maximum iterations before stopping |
| `--prompt, -p` | string | "default" | Preset name (`default`, `test-coverage`, `linting`, `duplication`, `entropy`) or path to custom prompt file |
| `--progress-file` | string | `.taskmaster/loop-progress.txt` | Path to progress log |
| `--sleep` | number | 5 | Seconds to sleep between iterations |
| `--on-complete` | string | - | Command to run when all tasks complete |
| `--tag` | string | - | Only work on tasks with this tag |
| `--status` | string | "pending" | Only work on tasks with this status |

### Built-in Presets

Presets are bundled markdown files that define the workflow for each iteration. The `--prompt` flag accepts either a preset name or a file path (detected by presence of `/`, `\`, or file extension).

| Preset | Description | Completion Criteria |
| ------ | ----------- | ------------------- |
| `default` | Standard task completion from Task Master backlog | All tasks done |
| `test-coverage` | Find uncovered lines, write meaningful tests | Coverage target reached |
| `linting` | Fix lint errors and type errors one by one | Zero lint errors |
| `duplication` | Hook into jscpd, refactor clones into shared utilities | No duplicates above threshold |
| `entropy` | Scan for code smells, clean them up | Entropy score below threshold |

#### Preset: `default`

```markdown
# Task Master Loop - Default Task Completion

You are completing tasks from a Task Master backlog. Complete ONE task per session.

## Files Available

- @.taskmaster/tasks/tasks.json - Your task backlog
- @.taskmaster/loop-progress.txt - Progress log from previous iterations

## Process

1. Run `task-master next` to get the highest priority available task
2. Read the task details carefully with `task-master show <id>`
3. Implement the task, focusing on the smallest possible change
4. Ensure quality:
   - Run tests if they exist
   - Run type check if applicable
   - Verify the implementation works as expected
5. Update the task status: `task-master set-status --id=<id> --status=done`
6. Commit your work with a descriptive message referencing the task ID
7. Append a brief note to the progress file about what was done

## Important

- Complete ONLY ONE task per session
- Keep changes small and focused
- Do NOT start another task after completing one
- If all tasks are complete, output: <loop-complete>ALL_TASKS_DONE</loop-complete>
- If you cannot complete the task, output: <loop-blocked>REASON</loop-blocked>
```

#### Preset: `test-coverage`

```markdown
# Task Master Loop - Test Coverage

Find uncovered code and write meaningful tests. ONE test per session.

## Files Available

- @.taskmaster/loop-progress.txt - Progress log (coverage %, what was tested)

## What Makes a Great Test

A great test covers behavior users depend on. It tests a feature that, if broken,
would frustrate or block users. It validates real workflows - not implementation details.

Do NOT write tests just to increase coverage. Use coverage as a guide to find
UNTESTED USER-FACING BEHAVIOR. If code is not worth testing (boilerplate, unreachable
branches, internal plumbing), add ignore comments instead of low-value tests.

## Process

1. Run coverage command (`pnpm coverage`, `npm run coverage`, etc.)
2. Identify the most important USER-FACING FEATURE that lacks tests
   - Prioritize: error handling users hit, CLI commands, API endpoints, file parsing
   - Deprioritize: internal utilities, edge cases users won't encounter, boilerplate
3. Write ONE meaningful test that validates the feature works correctly
4. Run coverage again - it should increase as a side effect of testing real behavior
5. Commit with message: `test(<file>): <describe the user behavior being tested>`
6. Append to progress file: what you tested, new coverage %, learnings

## Completion Criteria

- If coverage reaches target (or 100%), output: <loop-complete>COVERAGE_TARGET</loop-complete>
- Only write ONE test per iteration
```

#### Preset: `linting`

```markdown
# Task Master Loop - Linting

Fix lint errors and type errors one by one. ONE fix per session.

## Files Available

- @.taskmaster/loop-progress.txt - Progress log (errors fixed, remaining count)

## Process

1. Run lint command (`pnpm lint`, `npm run lint`, `eslint .`, etc.)
2. Run type check (`pnpm typecheck`, `tsc --noEmit`, etc.)
3. Pick ONE error to fix - prioritize:
   - Type errors (breaks builds)
   - Security-related lint errors
   - Errors in frequently-changed files
4. Fix the error with minimal changes - don't refactor surrounding code
5. Run lint/typecheck again to verify the fix doesn't introduce new errors
6. Commit with message: `fix(<file>): <describe the lint/type error fixed>`
7. Append to progress file: error fixed, remaining error count

## Completion Criteria

- If zero lint errors and zero type errors, output: <loop-complete>ZERO_ERRORS</loop-complete>
- Only fix ONE error per iteration
```

#### Preset: `duplication`

```markdown
# Task Master Loop - Duplication

Find duplicated code and refactor into shared utilities. ONE refactor per session.

## Files Available

- @.taskmaster/loop-progress.txt - Progress log (clones refactored, duplication %)

## Process

1. Run duplication detection (`npx jscpd .`, or similar tool)
2. Review the report and pick ONE clone to refactor - prioritize:
   - Larger clones (more lines = more maintenance burden)
   - Clones in frequently-changed files
   - Clones with slight variations (consolidate logic)
3. Extract the duplicated code into a shared utility/function
4. Update all clone locations to use the shared utility
5. Run tests to ensure behavior is preserved
6. Commit with message: `refactor(<file>): extract <utility> to reduce duplication`
7. Append to progress file: what was refactored, new duplication %

## Completion Criteria

- If duplication below threshold (e.g., <3%), output: <loop-complete>LOW_DUPLICATION</loop-complete>
- Only refactor ONE clone per iteration
```

#### Preset: `entropy`

```markdown
# Task Master Loop - Entropy (Code Smells)

Find code smells and clean them up. ONE cleanup per session.

## Files Available

- @.taskmaster/loop-progress.txt - Progress log (smells fixed, areas cleaned)

## Code Smells to Target

- Long functions (>60 lines) - extract into smaller functions
- Deep nesting (>3 levels) - use early returns, extract conditions
- Large files (>500 lines) - split into focused modules
- Magic numbers - extract into named constants
- Complex conditionals - extract into well-named functions
- God classes - split responsibilities

## Process

1. Scan the codebase for code smells (use your judgment or tools like `complexity-report`)
2. Pick ONE smell to fix - prioritize:
   - Smells in frequently-changed files
   - Smells that hurt readability the most
   - Smells in critical paths (authentication, payments, etc.)
3. Refactor with minimal changes - don't over-engineer
4. Run tests to ensure behavior is preserved
5. Commit with message: `refactor(<file>): <describe the cleanup>`
6. Append to progress file: what was cleaned, smell type

## Completion Criteria

- If no significant smells remain, output: <loop-complete>LOW_ENTROPY</loop-complete>
- Only fix ONE smell per iteration
```

### Core Logic (tm-core)

```typescript
// packages/tm-core/src/modules/loop/types.ts
export type LoopPreset = 'default' | 'test-coverage' | 'linting' | 'duplication' | 'entropy';

export interface LoopConfig {
  iterations: number;
  prompt: LoopPreset | string;  // Preset name or file path
  progressFile: string;
  sleepSeconds: number;
  onComplete?: string;
  tag?: string;
  status?: string;
}

export interface LoopIteration {
  iteration: number;
  taskId?: string;
  status: 'success' | 'blocked' | 'error' | 'complete';
  message?: string;
  duration?: number;
}

export interface LoopResult {
  iterations: LoopIteration[];
  totalIterations: number;
  tasksCompleted: number;
  finalStatus: 'all_complete' | 'max_iterations' | 'blocked' | 'error';
}
```

```typescript
// packages/tm-core/src/modules/loop/loop.service.ts
export class LoopService {
  // Resolve preset name to prompt content, or read custom file
  async resolvePrompt(prompt: LoopPreset | string): Promise<string>;

  // Check if string is a preset name or file path
  isPreset(prompt: string): prompt is LoopPreset;

  async generatePrompt(config: LoopConfig): Promise<string>;
  async appendProgress(progressFile: string, note: string): Promise<void>;
  async checkAllTasksComplete(options: { tag?: string; status?: string }): Promise<boolean>;
  async getClaudeCommand(prompt: string): Promise<string>;
}
```

### CLI Flow

```typescript
// Pseudocode for loop.command.ts
async execute(options: LoopOptions) {
  const tmCore = await createTmCore({ projectPath });

  for (let i = 1; i <= options.iterations; i++) {
    // Check if all tasks are done before starting (for default preset)
    if (options.prompt === 'default' && await tmCore.loop.checkAllTasksComplete({ tag: options.tag })) {
      console.log('All tasks complete!');
      if (options.onComplete) await exec(options.onComplete);
      return;
    }

    // Resolve preset or custom prompt
    const promptContent = await tmCore.loop.resolvePrompt(options.prompt);

    // Generate full prompt with context
    const prompt = await tmCore.loop.generatePrompt({ ...options, promptContent });

    // Run Claude Code
    const cmd = await tmCore.loop.getClaudeCommand(prompt);
    const result = await exec(cmd);  // claude -p "<prompt>"

    // Check for completion markers in output
    if (result.includes('<loop-complete>')) {
      console.log('Loop complete!');
      if (options.onComplete) await exec(options.onComplete);
      return;
    }

    // Sleep between iterations
    await sleep(options.sleepSeconds * 1000);
  }

  console.log(`Max iterations (${options.iterations}) reached`);
}
```

### Claude Code Integration

Loop runs Claude Code via CLI:

```bash
claude -p "<prompt>"
```

The prompt includes file references using `@` syntax so Claude Code loads the progress file and relevant context into context.

## Testing Strategy

### Unit Tests

1. **Preset resolution** - Verify preset names resolve to correct bundled prompts
2. **Custom prompt loading** - Verify file paths are read correctly
3. **Prompt detection** - Test `isPreset()` correctly distinguishes presets from file paths
4. **Progress file handling** - Test append operations, file creation if missing
5. **Task completion detection** - Test parsing of completion markers (`<loop-complete>`, `<loop-blocked>`)
6. **Claude command generation** - Verify correct command string formatting

### Integration Tests

1. **Full loop with mock agent** - Test iteration logic with mocked Claude responses
2. **Progress persistence** - Verify progress file survives across iterations
3. **Preset workflows** - Verify each preset generates expected prompt structure

### E2E Tests

1. **Real agent execution** (manual/CI) - Run loop with Claude Code on a test project
2. **Completion detection** - Verify loop stops when completion marker detected

## Success Metrics

1. Users can run loop with a single command
2. Built-in presets provide immediate value without configuration
3. Loop correctly identifies when tasks/goals are complete
4. Progress is maintained across iterations
5. Custom prompts work for domain-specific workflows
6. Integration with existing Task Master commands (next, show, set-status)

## Future Enhancements (v2)

1. **Multi-agent support** - Add codex, opencode, and custom agent support
2. **Sandbox mode** (`--sandbox`) - Run Claude Code inside a Docker container for isolation (e.g., `docker sandbox run claude -p "<prompt>"`)
3. **Structured activity log** - Replace progress.txt with `.taskmaster/activity.jsonl` or global `~/.taskmaster/workspaces/<project>/activity.jsonl` for structured logging across iterations
4. **Parallel Loop** - Run multiple loop instances on different task tags
5. **Terminal UI integration** - Monitor loop progress from Task Master terminal UI
6. **Slack/Discord notifications** - Notify channels on completion
7. **Custom preset registration** - Allow users to register their own presets globally

## References

- [Matt Pocock's Ralph Wiggum video](https://www.youtube.com/watch?v=example)
- [Jeffrey Huntley's original Ralph pattern](https://jeffreyhuntley.com/ralph-wiggum)
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/research/swe-bench-sonnet)
- [AI Hero](https://www.aihero.dev/)
