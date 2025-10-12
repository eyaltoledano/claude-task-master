Analyze task complexity and generate expansion recommendations.

Arguments: $ARGUMENTS

Perform deep analysis of task complexity across the project.

## Complexity Analysis

Uses AI to analyze tasks and recommend which ones need breakdown.

## Execution Options

```bash
task-master analyze-complexity [--research] [--threshold=5]
```

## Analysis Parameters

- `--research` → Use research AI for deeper analysis
- `--threshold=5` → Only flag tasks above complexity 5
- Default: Analyze all pending tasks

## Analysis Process

### 1. **Task Evaluation**
For each task, AI evaluates:
- Technical complexity
- Time requirements
- Dependency complexity
- Risk factors
- Knowledge requirements

### 2. **Complexity Scoring**
Assigns score 1-10 based on:
- Implementation difficulty
- Integration challenges
- Testing requirements
- Unknown factors
- Technical debt risk

### 3. **Recommendations**
For complex tasks:
- Suggest expansion approach
- Recommend subtask breakdown
- Identify risk areas
- Propose mitigation strategies

## Smart Analysis Features

1. **Pattern Recognition**
   - Similar task comparisons
   - Historical complexity accuracy
   - Team velocity consideration
   - Technology stack factors

2. **Contextual Factors**
   - Team expertise
   - Available resources
   - Timeline constraints
   - Business criticality

3. **Risk Assessment**
   - Technical risks
   - Timeline risks
   - Dependency risks
   - Knowledge gaps

## Output Format

```
Task Complexity Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

High Complexity Tasks (>7):
📍 #5 "Implement real-time sync" - Score: 9/10
   Factors: WebSocket complexity, state management, conflict resolution
   Recommendation: Expand into 5-7 subtasks
   Risks: Performance, data consistency

📍 #12 "Migrate database schema" - Score: 8/10
   Factors: Data migration, zero downtime, rollback strategy
   Recommendation: Expand into 4-5 subtasks
   Risks: Data loss, downtime

Medium Complexity Tasks (5-7):
📍 #23 "Add export functionality" - Score: 6/10
   Consider expansion if timeline tight

Low Complexity Tasks (<5):
✅ 15 tasks - No expansion needed

Summary:
- Expand immediately: 2 tasks
- Consider expanding: 5 tasks
- Keep as-is: 15 tasks
```

## Actionable Output

For each high-complexity task:
1. Complexity score with reasoning
2. Specific expansion suggestions
3. Risk mitigation approaches
4. Recommended subtask structure

## Integration

Results are:
- Saved to `.taskmaster/reports/complexity-analysis.md`
- Used by expand command
- Inform sprint planning
- Guide resource allocation

## Next Steps

After analysis:
```
/taskmaster:expand 5    # Expand specific task
/taskmaster:expand-all  # Expand all recommended
/taskmaster:complexity-report  # View detailed report
```