/**
 * @fileoverview Add Dependency Slash Command
 * Add a dependency between tasks.
 */

import { dynamicCommand } from '../../factories.js';

/**
 * The add-dependency slash command - Add Dependency
 *
 * Add a dependency between tasks.
 */
export const addDependency = dynamicCommand(
	'add-dependency',
	'Add Dependency',
	'<task-id> <depends-on-id>',
	`Add a dependency between tasks.

Arguments: $ARGUMENTS

Parse the task IDs to establish dependency relationship.

## Adding Dependencies

Creates a dependency where one task must be completed before another can start.

## Argument Parsing

Parse natural language or IDs:
- "make 5 depend on 3" → task 5 depends on task 3
- "5 needs 3" → task 5 depends on task 3
- "5 3" → task 5 depends on task 3
- "5 after 3" → task 5 depends on task 3

## Execution

\`\`\`bash
task-master add-dependency --id=<task-id> --depends-on=<dependency-id>
\`\`\`

## Validation

Before adding:
1. **Verify both tasks exist**
2. **Check for circular dependencies**
3. **Challenge necessity**: is this a hard data dependency (output blocks input) or just a preferred ordering?
4. **Assess critical path impact**: does this dependency lengthen the longest dependency chain?

## Smart Features

- Detect if dependency already exists
- Warn if this creates unnecessary serialization that lengthens the critical path
- Show impact on task flow and parallel execution capacity
- Suggest narrower alternatives if full task completion isn't required (e.g., interface agreement instead of full implementation)

## Post-Addition

After adding dependency:
1. Show updated dependency graph
2. Identify any newly blocked tasks
3. Suggest task order changes
4. Update project timeline

## Example Flows

\`\`\`
/taskmaster:add-dependency 5 needs 3
→ Task #5 now depends on Task #3
→ Task #5 is now blocked until #3 completes
→ Critical path impact: unchanged (task #5 was already on a longer chain)
\`\`\``,
	'solo'
);
