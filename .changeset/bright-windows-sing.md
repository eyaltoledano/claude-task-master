---
"task-master-ai": minor
---

Add comprehensive AI-powered research command with intelligent context gathering and interactive follow-ups.

The new `research` command provides AI-powered research capabilities that automatically gather relevant project context to answer your questions. The command intelligently selects context from multiple sources and supports interactive follow-up questions in CLI mode.

**Key Features:**

- **Intelligent Task Discovery**: Automatically finds relevant tasks and subtasks using fuzzy search based on your query keywords, supplementing any explicitly provided task IDs
- **Multi-Source Context**: Gathers context from tasks, files, project structure, and custom text to provide comprehensive answers
- **Interactive Follow-ups**: CLI users can ask follow-up questions that build on the conversation history while allowing fresh context discovery for each question
- **Flexible Detail Levels**: Choose from low (concise), medium (balanced), or high (comprehensive) response detail levels
- **Token Transparency**: Displays detailed token breakdown showing context size, sources, and estimated costs
- **Enhanced Display**: Syntax-highlighted code blocks and structured output with clear visual separation

**Usage Examples:**

```bash
# Basic research with auto-discovered context
task-master research "How should I implement user authentication?"

# Research with specific task context
task-master research "What's the best approach for this?" --id=15,23.2

# Research with file context and project tree
task-master research "How does the current auth system work?" --files=src/auth.js,config/auth.json --tree

# Research with custom context and low detail
task-master research "Quick implementation steps?" --context="Using JWT tokens" --detail=low
```

**Context Sources:**

- **Tasks**: Automatically discovers relevant tasks/subtasks via fuzzy search, plus any explicitly specified via `--id`
- **Files**: Include specific files via `--files` for code-aware responses
- **Project Tree**: Add `--tree` to include project structure overview
- **Custom Context**: Provide additional context via `--context` for domain-specific information

**Interactive Features (CLI only):**

- Follow-up questions that maintain conversation history
- Fresh fuzzy search for each follow-up to discover newly relevant tasks
- Cumulative context building across the conversation
- Clean visual separation between exchanges
- **Save to Tasks**: Save entire research conversations (including follow-ups) directly to task or subtask details with timestamps
- **Clean Menu Interface**: Streamlined inquirer-based menu for follow-up actions without redundant UI elements

**Save Functionality:**

The research command now supports saving complete conversation threads to tasks or subtasks:

- Save research results and follow-up conversations to any task (e.g., "15") or subtask (e.g., "15.2")
- Automatic timestamping and formatting of conversation history
- Validation of task/subtask existence before saving
- Appends to existing task details without overwriting content
- Supports both CLI interactive mode and MCP programmatic access via `--save-to` flag

**Enhanced CLI Options:**

```bash
# Auto-save research results to a task
task-master research "Implementation approach?" --save-to=15

# Combine auto-save with context gathering
task-master research "How to optimize this?" --id=23 --save-to=23.1
```

**MCP Integration:**

- `saveTo` parameter for automatic saving to specified task/subtask ID
- Structured response format with telemetry data
- Silent operation mode for programmatic usage
- Full feature parity with CLI except interactive follow-ups

The research command integrates with the existing AI service layer and supports all configured AI providers. Both CLI and MCP interfaces provide comprehensive research capabilities with intelligent context gathering and flexible output options.

