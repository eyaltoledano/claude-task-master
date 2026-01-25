/**
 * @fileoverview Entropy (Code Smells) preset for loop module
 */

export const ENTROPY_PRESET = `# Taskmaster Loop - Entropy (Code Smells)

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
`;
