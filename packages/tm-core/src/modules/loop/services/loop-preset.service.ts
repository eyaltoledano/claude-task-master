/**
 * @fileoverview Loop preset service with inlined preset content
 * Presets are inlined as string constants to eliminate path resolution issues during bundling
 */

import type { LoopPreset } from '../types.js';

/**
 * Inlined preset content for all available presets
 * This approach eliminates filesystem reads and path resolution complexity
 */
const PRESETS: Record<LoopPreset, string> = {
	default: `# Task Master Loop - Default Task Completion

You are completing tasks from a Task Master backlog. Complete ONE task per session.

## Files Available

- @.taskmaster/tasks/tasks.json - Your task backlog
- @.taskmaster/loop-progress.txt - Progress log from previous iterations

## Process

1. Run \`task-master next\` to get the highest priority available task
2. Read the task details carefully with \`task-master show <id>\`
3. Implement the task, focusing on the smallest possible change
4. Ensure quality:
   - Run tests if they exist
   - Run type check if applicable
   - Verify the implementation works as expected
5. Update the task status: \`task-master set-status --id=<id> --status=done\`
6. Commit your work with a descriptive message referencing the task ID
7. Append a brief note to the progress file about what was done

## Important

- Complete ONLY ONE task per session
- Keep changes small and focused
- Do NOT start another task after completing one
- If all tasks are complete, output: <loop-complete>ALL_TASKS_DONE</loop-complete>
- If you cannot complete the task, output: <loop-blocked>REASON</loop-blocked>
`,

	'test-coverage': `# Task Master Loop - Test Coverage

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

1. Run coverage command (\`pnpm coverage\`, \`npm run coverage\`, etc.)
2. Identify the most important USER-FACING FEATURE that lacks tests
   - Prioritize: error handling users hit, CLI commands, API endpoints, file parsing
   - Deprioritize: internal utilities, edge cases users won't encounter, boilerplate
3. Write ONE meaningful test that validates the feature works correctly
4. Run coverage again - it should increase as a side effect of testing real behavior
5. Commit with message: \`test(<file>): <describe the user behavior being tested>\`
6. Append to progress file: what you tested, new coverage %, learnings

## Important

- Complete ONLY ONE test per session
- Keep tests focused on user-facing behavior
- Do NOT start another test after completing one

## Completion Criteria

- If coverage reaches target (or 100%), output: <loop-complete>COVERAGE_TARGET</loop-complete>
`,

	linting: `# Task Master Loop - Linting

Fix lint errors and type errors one by one. ONE fix per session.

## Files Available

- @.taskmaster/loop-progress.txt - Progress log (errors fixed, remaining count)

## Process

1. Run lint command (\`pnpm lint\`, \`npm run lint\`, \`eslint .\`, etc.)
2. Run type check (\`pnpm typecheck\`, \`tsc --noEmit\`, etc.)
3. Pick ONE error to fix - prioritize:
   - Type errors (breaks builds)
   - Security-related lint errors
   - Errors in frequently-changed files
4. Fix the error with minimal changes - don't refactor surrounding code
5. Run lint/typecheck again to verify the fix doesn't introduce new errors
6. Commit with message: \`fix(<file>): <describe the lint/type error fixed>\`
7. Append to progress file: error fixed, remaining error count

## Important

- Complete ONLY ONE fix per session
- Keep changes minimal and focused
- Do NOT start another fix after completing one

## Completion Criteria

- If zero lint errors and zero type errors, output: <loop-complete>ZERO_ERRORS</loop-complete>
`,

	duplication: `# Task Master Loop - Duplication

Find duplicated code and refactor into shared utilities. ONE refactor per session.

## Files Available

- @.taskmaster/loop-progress.txt - Progress log (clones refactored, duplication %)

## Process

1. Run duplication detection (\`npx jscpd .\`, or similar tool)
2. Review the report and pick ONE clone to refactor - prioritize:
   - Larger clones (more lines = more maintenance burden)
   - Clones in frequently-changed files
   - Clones with slight variations (consolidate logic)
3. Extract the duplicated code into a shared utility/function
4. Update all clone locations to use the shared utility
5. Run tests to ensure behavior is preserved
6. Commit with message: \`refactor(<file>): extract <utility> to reduce duplication\`
7. Append to progress file: what was refactored, new duplication %

## Important

- Complete ONLY ONE refactor per session
- Keep changes focused on the specific duplication
- Do NOT start another refactor after completing one

## Completion Criteria

- If duplication below threshold (e.g., <3%), output: <loop-complete>LOW_DUPLICATION</loop-complete>
`,

	entropy: `# Task Master Loop - Entropy (Code Smells)

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

1. Scan the codebase for code smells (use your judgment or tools like \`complexity-report\`)
2. Pick ONE smell to fix - prioritize:
   - Smells in frequently-changed files
   - Smells that hurt readability the most
   - Smells in critical paths (authentication, payments, etc.)
3. Refactor with minimal changes - don't over-engineer
4. Run tests to ensure behavior is preserved
5. Commit with message: \`refactor(<file>): <describe the cleanup>\`
6. Append to progress file: what was cleaned, smell type

## Important

- Complete ONLY ONE cleanup per session
- Keep refactoring focused and minimal
- Do NOT start another cleanup after completing one

## Completion Criteria

- If no significant smells remain, output: <loop-complete>LOW_ENTROPY</loop-complete>
`
};

/**
 * Array of all available preset names
 */
export const PRESET_NAMES: readonly LoopPreset[] = [
	'default',
	'test-coverage',
	'linting',
	'duplication',
	'entropy'
] as const;

/**
 * Service for loading and managing loop presets
 * Uses inlined content to avoid filesystem dependencies and bundling issues
 */
export class LoopPresetService {
	/**
	 * Type guard to check if a string is a valid preset name
	 * @param input - The string to check
	 * @returns True if the input is a valid LoopPreset
	 */
	isPreset(input: string): input is LoopPreset {
		return input in PRESETS;
	}

	/**
	 * Check if a string is a valid preset name (static method)
	 * @param name - The name to check
	 * @returns True if the name is a valid LoopPreset
	 */
	static isValidPreset(name: string): name is LoopPreset {
		return name in PRESETS;
	}

	/**
	 * Get the content of a preset by name
	 * @param preset - The preset name to load
	 * @returns The preset content string
	 * @throws Error if the preset is not found
	 */
	getPresetContent(preset: LoopPreset): string {
		const content = PRESETS[preset];
		if (!content) {
			throw new Error(
				`Preset '${preset}' not found. Available presets: ${PRESET_NAMES.join(', ')}`
			);
		}
		return content;
	}

	/**
	 * Get all available preset names
	 * @returns Array of all preset names
	 */
	getPresetNames(): readonly LoopPreset[] {
		return PRESET_NAMES;
	}

	/**
	 * Load preset content synchronously (no filesystem access needed)
	 * @param preset - The preset name to load
	 * @returns The preset content string
	 */
	loadPreset(preset: LoopPreset): string {
		return this.getPresetContent(preset);
	}
}
