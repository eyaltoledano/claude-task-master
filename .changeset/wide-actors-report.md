---
"task-master-ai": minor
---

Add Claude Code subagent support with task-orchestrator, task-executor, and task-checker

## New Claude Code Agents

Added specialized agents for Claude Code users to enable parallel task execution, intelligent task orchestration, and quality assurance:

### task-orchestrator
Coordinates and manages the execution of Task Master tasks with intelligent dependency analysis:
- Analyzes task dependencies to identify parallelizable work
- Deploys multiple task-executor agents for concurrent execution
- Monitors task completion and updates the dependency graph
- Automatically identifies and starts newly unblocked tasks

### task-executor  
Handles the actual implementation of individual tasks:
- Executes specific tasks identified by the orchestrator
- Works on concrete implementation rather than planning
- Updates task status and logs progress
- Can work in parallel with other executors on independent tasks

### task-checker
Verifies that completed tasks meet their specifications:
- Reviews tasks marked as 'review' status
- Validates implementation against requirements
- Runs tests and checks for best practices
- Ensures quality before marking tasks as 'done'

## Installation

When using the Claude profile (`task-master rules add claude`), the agents are automatically installed to `.claude/agents/` directory.

## Usage Example

```bash
# In Claude Code, after initializing a project with tasks:

# Use task-orchestrator to analyze and coordinate work
# The orchestrator will:
# 1. Check task dependencies
# 2. Identify tasks that can run in parallel  
# 3. Deploy executors for available work
# 4. Monitor progress and deploy new executors as tasks complete

# Use task-executor for specific task implementation
# When the orchestrator identifies task 2.3 needs work:
# The executor will implement that specific task
```

## Benefits

- **Parallel Execution**: Multiple independent tasks can be worked on simultaneously
- **Intelligent Scheduling**: Orchestrator understands dependencies and optimizes execution order
- **Separation of Concerns**: Planning (orchestrator) is separated from execution (executor)
- **Progress Tracking**: Real-time updates as tasks are completed
- **Automatic Progression**: As tasks complete, newly unblocked tasks are automatically started
