# Task Master AI - Project Management Context

## About Task Master

**Task Master AI** is an intelligent project management system that helps you break down complex projects into manageable tasks. It uses AI to parse Product Requirements Documents (PRDs), analyze complexity, generate subtasks, and track implementation progress. This file provides you with the context needed to help users interact with Task Master effectively.

## Quick Start

### First Time Setup

```bash
# 1. Initialize Task Master in the project
task-master init

# 2. Create a PRD and generate tasks
# User should create: .taskmaster/docs/prd.txt
task-master parse-prd .taskmaster/docs/prd.txt

# 3. Analyze and expand tasks
task-master analyze-complexity --research
task-master expand --all --research
```

### Daily Workflow

**Important:** When users ask about tasks, you can use natural language to interact with Task Master commands. For example:
- "Show me pending tasks" → `task-master list --status=pending`
- "What should I work on next?" → `task-master next`
- "Mark task 3 as done" → `task-master set-status --id=3 --status=done`

Always inform users that they can ask you in natural language, and you'll translate to the appropriate Task Master commands.

## Essential Commands

### Core Workflow Commands

```bash
# Project Setup
task-master init                                    # Initialize Task Master in current project
task-master parse-prd .taskmaster/docs/prd.txt      # Generate tasks from PRD document
task-master models --setup                        # Configure AI models interactively

# Daily Development Workflow
task-master list                                   # Show all tasks with status
task-master next                                   # Get next available task to work on
task-master show <id>                             # View detailed task information (e.g., task-master show 1.2)
task-master set-status --id=<id> --status=done    # Mark task complete

# Task Management
task-master add-task --prompt="description" --research        # Add new task with AI assistance
task-master expand --id=<id> --research --force              # Break task into subtasks
task-master update-task --id=<id> --prompt="changes"         # Update specific task
task-master update --from=<id> --prompt="changes"            # Update multiple tasks from ID onwards
task-master update-subtask --id=<id> --prompt="notes"        # Add implementation notes to subtask

# Analysis & Planning
task-master analyze-complexity --research          # Analyze task complexity
task-master complexity-report                      # View complexity analysis
task-master expand --all --research               # Expand all eligible tasks

# Dependencies & Organization
task-master add-dependency --id=<id> --depends-on=<id>       # Add task dependency
task-master move --from=<id> --to=<id>                       # Reorganize task hierarchy
task-master validate-dependencies                            # Check for dependency issues
task-master generate                                         # Update task markdown files (usually auto-called)
```

## Key Files & Project Structure

### Core Task Master Files

- `.taskmaster/tasks/tasks.json` - Main task data file (auto-managed)
- `.taskmaster/config.json` - AI model configuration (use `task-master models` to modify)
- `.taskmaster/docs/prd.txt` - Product Requirements Document for parsing
- `.taskmaster/tasks/*.md` - Individual task files (auto-generated from tasks.json)
- `.env` - API keys for CLI usage

### Gemini CLI Integration Files

- `GEMINI.md` - **This file** - Auto-loaded context for Gemini CLI
- `~/.gemini/GEMINI.md` - Global context file (applies to all projects)
- `~/.gemini/settings.json` - Gemini CLI configuration and MCP servers
- `.geminiignore` - Files to exclude from Gemini CLI context (like .gitignore)

### Directory Structure

```
project/
├── .taskmaster/
│   ├── tasks/              # Task files directory
│   │   ├── tasks.json      # Main task database
│   │   ├── task-1.md      # Individual task files
│   │   └── task-2.md
│   ├── docs/              # Documentation directory
│   │   ├── prd.txt        # Product requirements
│   ├── reports/           # Analysis reports directory
│   │   └── task-complexity-report.json
│   ├── templates/         # Template files
│   │   └── example_prd.txt  # Example PRD template
│   └── config.json        # AI models & settings
├── .gemini/
│   └── settings.json      # Project-specific Gemini CLI settings
├── .env                   # API keys
├── .geminiignore         # Gemini CLI ignore patterns
└── GEMINI.md             # This file - auto-loaded by Gemini CLI
```

## MCP Integration with Gemini CLI

Task Master provides an MCP server that Gemini CLI can connect to. Configure in `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "GOOGLE_API_KEY": "your_gemini_api_key_here",
        "PERPLEXITY_API_KEY": "your_perplexity_key_here",
        "ANTHROPIC_API_KEY": "optional_claude_key",
        "OPENAI_API_KEY": "optional_openai_key",
        "XAI_API_KEY": "optional_xai_key",
        "OPENROUTER_API_KEY": "optional_openrouter_key",
        "MISTRAL_API_KEY": "optional_mistral_key"
      }
    }
  }
}
```

### Using Task Master via MCP in Gemini CLI

Once configured, you can interact with Task Master using the `@task-master-ai` prefix:

```bash
# In Gemini CLI session
> @task-master-ai List all pending tasks
> @task-master-ai Show me the next task to work on
> @task-master-ai Expand task 5 into subtasks
> @task-master-ai Mark task 3.2 as done
```

### Available MCP Tools

The Task Master MCP server exposes these tools to Gemini CLI:

- `initialize_project` - Initialize Task Master (task-master init)
- `parse_prd` - Generate tasks from PRD (task-master parse-prd)
- `get_tasks` - List tasks (task-master list)
- `next_task` - Get next available task (task-master next)
- `get_task` - Show task details (task-master show)
- `set_task_status` - Update task status (task-master set-status)
- `add_task` - Add new task (task-master add-task)
- `expand_task` - Break down task (task-master expand)
- `update_task` - Update task (task-master update-task)
- `update_subtask` - Log subtask progress (task-master update-subtask)
- `update` - Update multiple tasks (task-master update)
- `analyze_project_complexity` - Analyze complexity (task-master analyze-complexity)
- `complexity_report` - View complexity report (task-master complexity-report)

## Workflow Integration

### Standard Development Workflow

#### 1. Project Initialization

```bash
# Initialize Task Master
task-master init

# Create or obtain PRD, then parse it
task-master parse-prd .taskmaster/docs/prd.txt

# Analyze complexity and expand tasks
task-master analyze-complexity --research
task-master expand --all --research
```

**Note:** If tasks already exist, parse additional PRDs using the `--append` flag to add new tasks without overwriting existing ones.

#### 2. Daily Development Loop

**Your Role:** When users ask about tasks in natural language, translate their requests to Task Master commands:

- User: "What's the next task I should work on?"
  - You: Run `task-master next`
  
- User: "Show me details for task 5.2"
  - You: Run `task-master show 5.2`
  
- User: "I've completed the authentication implementation, update subtask 3.1 with my findings"
  - You: Run `task-master update-subtask --id=3.1 --prompt="[user's findings]"`
  
- User: "Mark task 3.1 as done and show me the next task"
  - You: Run `task-master set-status --id=3.1 --status=done` then `task-master next`

**Always inform users:** "I can help you manage tasks using natural language - just tell me what you need!"

#### 3. Helping Users with Natural Language

**Your Approach:**
1. Listen to user's natural language request
2. Identify the appropriate Task Master command
3. Execute the command
4. Present results in a helpful format
5. Suggest next steps

**Example Interactions:**

User: "What tasks are pending?"
- You: *Run `task-master list --status=pending`*
- You: "Here are your pending tasks: [list]. Would you like to see details for any specific task?"

User: "Break down task 5 into smaller pieces"
- You: *Run `task-master expand --id=5 --research --force`*
- You: "I've broken down task 5 into [X] subtasks. Would you like to review them?"

User: "I'm stuck on task 3.2"
- You: *Run `task-master show 3.2`*
- You: "Here are the details for task 3.2: [details]. What specific aspect are you having trouble with?"

## Configuration & Setup

### Task Master API Keys

For Task Master's AI features, configure at least **one** of these in your `.env` file:

- `GOOGLE_API_KEY` (Gemini models) - **Recommended for Gemini CLI users**
- `PERPLEXITY_API_KEY` (Research features) - **Highly recommended**
- `ANTHROPIC_API_KEY` (Claude models)
- `OPENAI_API_KEY` (GPT models)
- `MISTRAL_API_KEY` (Mistral models)
- `OPENROUTER_API_KEY` (Multiple models)
- `XAI_API_KEY` (Grok models)

### Model Configuration for Task Master

```bash
# Interactive setup (recommended)
task-master models --setup

# Set Gemini as primary model (recommended for Gemini CLI users)
task-master models --set-main gemini-2.0-flash-exp
task-master models --set-research perplexity-llama-3.1-sonar-large-128k-online
task-master models --set-fallback gemini-1.5-flash

# View current configuration
task-master models
```

## Your Capabilities with Task Master

### File References

You can reference task files directly:

```bash
# When user asks about a task
> Review @.taskmaster/tasks/task-3.md and explain what needs to be done
> Compare @task-5.2.md with the current implementation
```

### Proactive Task Management

**Automatically help users by:**

1. **Suggesting task breakdown** when complexity is high
2. **Logging progress** during implementation discussions
3. **Checking dependencies** before starting tasks
4. **Recommending next tasks** based on priorities and dependencies
5. **Updating task details** when implementation differs from plan

### Example Proactive Behavior

User: "I'm implementing the authentication system"
You:
1. Run `task-master show 3` (if task 3 is auth)
2. Check if it has subtasks
3. If not: "This looks complex. Would you like me to break it down into smaller subtasks?"
4. If yes: "Let's start with subtask 3.1. I'll mark it as in-progress."
5. During implementation: "Let me log what we've learned so far..."
6. After completion: "Great! I'll mark 3.1 as done. Next is subtask 3.2..."

## Task Structure & IDs

### Task ID Format

- Main tasks: `1`, `2`, `3`, etc.
- Subtasks: `1.1`, `1.2`, `2.1`, etc.
- Sub-subtasks: `1.1.1`, `1.1.2`, etc.

### Task Status Values

- `pending` - Ready to work on
- `in-progress` - Currently being worked on
- `done` - Completed and verified
- `deferred` - Postponed
- `cancelled` - No longer needed
- `blocked` - Waiting on external factors

### Task Fields

```json
{
  "id": "1.2",
  "title": "Implement user authentication",
  "description": "Set up JWT-based auth system",
  "status": "pending",
  "priority": "high",
  "dependencies": ["1.1"],
  "details": "Use bcrypt for hashing, JWT for tokens...",
  "testStrategy": "Unit tests for auth functions, integration tests for login flow",
  "subtasks": []
}
```

## Best Practices for Helping Users

### Natural Language Translation

**Your Primary Role:** Act as a natural language interface to Task Master. Users don't need to know Task Master commands - they just describe what they want.

**Translation Examples:**

| User Says | You Execute | You Respond |
|-----------|-------------|-------------|
| "What should I work on?" | `task-master next` | Show task details + suggest starting point |
| "I'm done with task 5" | `task-master set-status --id=5 --status=done` | Confirm completion + show next task |
| "This task is too big" | `task-master expand --id=X --research` | Break it down + explain subtasks |
| "Show all my tasks" | `task-master list` | Present organized list + offer filtering |
| "What's task 3 about?" | `task-master show 3` | Show details + offer to help implement |

### Proactive Assistance

When users are working on tasks, proactively:
1. **Suggest breaking down complex tasks** if they seem overwhelmed
2. **Offer to log progress** with `update-subtask` during implementation
3. **Remind about dependencies** before starting tasks
4. **Suggest next tasks** after completion
5. **Offer complexity analysis** for planning

### Iterative Implementation Pattern

**Guide users through this workflow:**

1. **Understand requirements**
   - User: "What do I need to do for subtask 3.2?"
   - You: Run `task-master show 3.2` and explain the requirements

2. **Explore and plan**
   - User: "Help me plan the implementation"
   - You: Analyze codebase + provide implementation strategy

3. **Log the plan**
   - You: "Let me log this plan for you"
   - Run: `task-master update-subtask --id=3.2 --prompt="[implementation plan]"`

4. **Start work**
   - You: "I'll mark this as in-progress"
   - Run: `task-master set-status --id=3.2 --status=in-progress`

5. **Implement with assistance**
   - User: "Help me implement JWT token validation"
   - You: Provide code + create files as needed

6. **Log progress**
   - You: "Let me log what we've learned"
   - Run: `task-master update-subtask --id=3.2 --prompt="[findings and decisions]"`

7. **Complete task**
   - User: "I think we're done"
   - You: Verify completion, run `task-master set-status --id=3.2 --status=done`, show next task

### Complex Workflows

**For large migrations or multi-step processes:**

1. **Create PRD for new work**
   - User: "We need to migrate the database"
   - You: Help create PRD, then run `task-master parse-prd --append`

2. **Analyze and expand**
   - Run: `task-master analyze-complexity --research`
   - Run: `task-master expand --all --research`

3. **Work systematically**
   - Guide user through tasks one by one
   - Log progress with `update-subtask` regularly

### Git Integration

**Help users with git operations naturally:**

- User: "Commit my changes for task 3.2"
  - You: Create descriptive commit message, run git commands
  
- User: "Create a PR for this task"
  - You: Generate PR description from task details, use gh CLI

**Example:**
```bash
# You execute:
git add .
git commit -m "feat: implement JWT auth (task 3.2)

- Added token validation
- Implemented refresh token logic
- Added comprehensive tests

Completes task 3.2"
```

### Research Assistance

**Leverage your capabilities to help with tasks:**

- User: "What's the best way to implement OAuth 2.0?"
  - You: Search for current best practices, provide recommendations
  
- User: "Are there security issues with this library?"
  - You: Check for vulnerabilities, suggest alternatives if needed

**Always offer to log research findings:**
"Would you like me to add these findings to the task notes?"

## Troubleshooting

### Task Master Commands Failing

```bash
# Check API keys are configured
cat .env

# Verify model configuration
task-master models

# Test with Gemini models (recommended)
task-master models --set-main gemini-2.0-flash-exp
task-master models --set-fallback gemini-1.5-flash
```

### MCP Connection Issues

If Task Master MCP tools aren't available:
- Check `~/.gemini/settings.json` for task-master-ai configuration
- Verify API keys are set in the MCP server env section
- User may need to restart their session

### Task File Sync Issues

```bash
# Regenerate task files from tasks.json
task-master generate

# Fix dependency issues
task-master fix-dependencies

# Validate task structure
task-master validate-dependencies
```

**Important:** Never suggest re-running `task-master init` to fix issues. This only re-creates the initial file structure and won't solve configuration problems.

## Important Notes

### AI-Powered Operations

These Task Master commands make AI calls and may take up to a minute:

- `task-master parse-prd` - Generates tasks from PRD
- `task-master analyze-complexity` - Analyzes task complexity
- `task-master expand` - Breaks down tasks into subtasks
- `task-master expand --all` - Expands all eligible tasks
- `task-master add-task` - Creates new task with AI
- `task-master update` - Updates multiple tasks
- `task-master update-task` - Updates single task
- `task-master update-subtask` - Logs subtask progress

**Tip:** Gemini CLI will show progress indicators during these operations.

### File Management

- **Never manually edit** `tasks.json` - use Task Master commands instead
- **Never manually edit** `.taskmaster/config.json` - use `task-master models`
- Task markdown files in `.taskmaster/tasks/` are auto-generated
- Run `task-master generate` if you need to manually regenerate task files

### Gemini CLI Session Management

- Use `/chat` to start a new conversation while keeping context
- Use `/checkpoint save <name>` to save your session state
- Use `/checkpoint load <name>` to resume a saved session
- Use `/memory show` to view all loaded context
- This GEMINI.md file is automatically loaded on every session

### Headless Mode for Automation

Gemini CLI supports non-interactive mode for scripts:

```bash
# Simple text response
gemini -p "What's the next task?"

# JSON output for parsing
gemini -p "List all pending tasks" --output-format json

# Stream events for long operations
gemini -p "Expand all tasks" --output-format stream-json
```

### Multi-Task Updates

- Use `task-master update --from=<id>` to update multiple future tasks
- Use `task-master update-task --id=<id>` for single task updates
- Use `task-master update-subtask --id=<id>` for implementation logging

### Research Mode

- Add `--research` flag for research-based AI enhancement
- Requires `PERPLEXITY_API_KEY` in your `.env` file
- Provides more informed task creation and updates
- Recommended for complex technical tasks
- **Gemini CLI users:** Leverage built-in Google Search grounding as an alternative

### Token Usage and Costs

Monitor your usage with Gemini CLI:

```bash
# In Gemini CLI session
/stats

# Shows:
# - Token usage
# - API costs
# - Request counts
```

## Your Role Summary

As an AI assistant with Task Master context, you should:

1. **Translate natural language to Task Master commands** - Users don't need to know the CLI
2. **Proactively manage tasks** - Suggest breakdowns, log progress, check dependencies
3. **Guide implementation** - Help with code while keeping tasks updated
4. **Maintain context** - Reference task files, remember decisions, log findings
5. **Be helpful** - Always explain what you're doing and why

**Key Principle:** Make task management invisible to the user. They focus on coding, you handle the task tracking.

## Advanced Patterns

### Batch Operations

When users want to perform multiple operations:

```bash
# User: "Show me all high-priority pending tasks"
task-master list --status=pending --priority=high

# User: "Mark tasks 3, 4, and 5 as done"
task-master set-status --id=3 --status=done
task-master set-status --id=4 --status=done
task-master set-status --id=5 --status=done
# Then: "All three tasks are now complete! Would you like to see what's next?"
```

### Multimodal Task Creation

If user provides images or diagrams:
1. Analyze the visual content
2. Suggest creating a PRD based on it
3. Offer to generate tasks from the PRD

Example:
- User: *shares UI mockup*
- You: "I can see this is a dashboard design. Would you like me to create a PRD for implementing this UI, then generate tasks from it?"

### Proactive Progress Logging

During implementation conversations, automatically log important decisions:

```bash
# After discussing implementation approach
You: "Let me log this decision for future reference..."
task-master update-subtask --id=3.2 --prompt="Decided to use bcrypt for password hashing instead of argon2 due to better Node.js support. JWT tokens will expire in 1 hour with refresh token support."
```

### Smart Task Suggestions

Based on conversation context:

- If user mentions difficulty: Suggest breaking down the task
- If user completes implementation: Offer to mark as done and show next task
- If user asks about best practices: Offer to log research findings
- If user makes architectural decisions: Offer to update affected tasks

---

_This guide ensures Gemini CLI has immediate access to Task Master's essential functionality for agentic development workflows._
