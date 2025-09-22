Expand all pending tasks that need subtasks.

## Bulk Task Expansion

Intelligently expands all tasks that would benefit from breakdown.

## Execution

```bash
task-master expand --all
```

## Smart Selection

Only expands tasks that:
- Are marked as pending
- Have high complexity (>5)
- Lack existing subtasks
- Would benefit from breakdown

## Expansion Process

1. **Analysis Phase**
   - Identify expansion candidates
   - Group related tasks
   - Plan expansion strategy

2. **Batch Processing**
   - Expand tasks in logical order
   - Maintain consistency
   - Preserve relationships
   - Optimize for parallelism

3. **Quality Control**
   - Ensure subtask quality
   - Avoid over-decomposition
   - Maintain task coherence
   - Update dependencies

## Options

- Add `force` to expand all regardless of complexity
- Add `research` for enhanced AI analysis

## Results

After bulk expansion:
- Summary of tasks expanded
- New subtask count
- Updated complexity metrics
- Suggested task order