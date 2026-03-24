/**
 * Test coverage preset for Taskmaster loop - writing meaningful tests
 */
export const TEST_COVERAGE_PRESET = `# Taskmaster Loop - Test Coverage

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
`;
