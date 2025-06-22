Parse a PRD document to generate tasks.

Arguments: $ARGUMENTS (PRD file path)

## Intelligent PRD Parsing

Analyzes your requirements document and generates a complete task breakdown.

## Execution

```bash
task-master parse-prd --input=$ARGUMENTS
```

## Parsing Process

1. **Document Analysis**
   - Extract key requirements
   - Identify technical components
   - Detect dependencies
   - Estimate complexity

2. **Task Generation**
   - Create 10-15 tasks by default
   - Include implementation tasks
   - Add testing tasks
   - Include documentation tasks
   - Set logical dependencies

3. **Smart Enhancements**
   - Group related functionality
   - Set appropriate priorities
   - Add acceptance criteria
   - Include test strategies

## Options

Parse arguments for modifiers:
- Number after filename → `--num-tasks`
- `research` → Use research mode
- `comprehensive` → Generate more tasks

## Post-Generation

After parsing:
1. Display task summary
2. Show dependency graph
3. Suggest task expansion for complex items
4. Recommend sprint planning