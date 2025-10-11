Add new tasks with intelligent parsing and context awareness.

Arguments: $ARGUMENTS

## Smart Task Addition

Parse natural language to create well-structured tasks.

### 1. **Input Understanding**

I'll intelligently parse your request:
- Natural language → Structured task
- Detect priority from keywords (urgent, ASAP, important)
- Infer dependencies from context
- Suggest complexity based on description
- Determine task type (feature, bug, refactor, test, docs)

### 2. **Smart Parsing Examples**

**"Add urgent task to fix login bug"**
→ Title: Fix login bug
→ Priority: high
→ Type: bug
→ Suggested complexity: medium

**"Create task for API documentation after task 23 is done"**
→ Title: API documentation
→ Dependencies: [23]
→ Type: documentation
→ Priority: medium

**"Need to refactor auth module - depends on 12 and 15, high complexity"**
→ Title: Refactor auth module
→ Dependencies: [12, 15]
→ Complexity: high
→ Type: refactor

### 3. **Context Enhancement**

Based on current project state:
- Suggest related existing tasks
- Warn about potential conflicts
- Recommend dependencies
- Propose subtasks if complex

### 4. **Interactive Refinement**

```yaml
Task Preview:
─────────────
Title: [Extracted title]
Priority: [Inferred priority]
Dependencies: [Detected dependencies]
Complexity: [Estimated complexity]

Suggestions:
- Similar task #34 exists, consider as dependency?
- This seems complex, break into subtasks?
- Tasks #45-47 work on same module
```

### 5. **Validation & Creation**

Before creating:
- Validate dependencies exist
- Check for duplicates
- Ensure logical ordering
- Verify task completeness

### 6. **Smart Defaults**

Intelligent defaults based on:
- Task type patterns
- Team conventions
- Historical data
- Current sprint/phase

Result: High-quality tasks from minimal input.