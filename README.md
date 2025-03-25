#
# Task Master
### by [@eyaltoledano](https://x.com/eyaltoledano)

Sick of @cursor\_ai rewriting good code or going in circles?

Introducing Task Master ✨

A CLI that turns your PRD into a local task management system for Cursor Agent

Graduate from building cute little apps to ambitious projects without overwhelming yourself or Cursor

![Image](https://pbs.twimg.com/media/GmoQ0epa8AAXf8-.jpg)

Giving AI a full PRD often leads to confusion.

My solution? A custom script that intelligently breaks down massive PRDs into clear, ordered, dependency-aware tasks:

• Clear focus for Cursor
• Reliable, sequential implementation
• Eliminates overwhelm/boosts clarity

Also 👇 ![Image](https://pbs.twimg.com/media/GmoRWjYWcAA5mC9.jpg)

Ambitious projects evolve, and early decisions make your PRD stale—leading to “implementation drift” and dependency hell

Most give up here.

My solution lets Cursor Agent manage task updates:
• Single command + short prompt
• Automatically adjusts all future tasks

How? ![Image](https://pbs.twimg.com/media/GmoRXRxXwAAsV-3.jpg)

Integrating this workflow with Cursor AI is seamless:

• Add this to your project with one CLI command
• Drop your PRD.txt into the correct folder
• Turn it into tasks.json
• Research & expand tasks into sub-tasks
• Cursor Agent will use the script and its commands to build ![Image](https://pbs.twimg.com/media/GmoRXrMaEAMG7JN.jpg)


**Table of Contents:**

- [Project Description](#project-description)
- [Requirements](#requirements)
- [Configuration](#configuration)
- [Installation](#installation)
- [Quick Start](#quick-start-with-global-commands)
- [Troubleshooting](#troubleshooting)
- [Task Structure](#task-structure)
- [Integrating with Cursor AI](#integrating-with-cursor-ai)
- [AI-Driven Development Workflow](#ai-driven-development-workflow)
- [Command Reference](#command-reference)
- [Feature Details](#feature-details)
- [Best Practices for AI-Driven Development](#best-practices-for-ai-driven-development)
- [Example Cursor AI Interactions](#example-cursor-ai-interactions)


# Using Task Master AI with Cline

Task Master AI is a CLI tool that helps you manage AI-driven development tasks. It allows you to break down a Product Requirements Document (PRD) into a set of sequential development tasks, manage task dependencies, analyze task complexity, and generate task files.

### Installation

To install Task Master AI, run the following command:

```bash
npm install -g task-master-ai
```

### Configuration

To configure Task Master AI with Cline, you need to set the following environment variables in a `.env` file at the root of your project:

*   `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude (required if not using OpenRouter)
*   `OPENROUTER_API_KEY`: Your OpenRouter API key for using OpenRouter as an AI provider (optional)

You can also configure the following optional environment variables:

*   `MODEL`: Specify which Claude model to use (default: "claude-3-7-sonnet-20250219")
*   `MAX_TOKENS`: Maximum tokens for model responses (default: 4000)
*   `TEMPERATURE`: Temperature for model responses (default: 0.7)
*   `PERPLEXITY_API_KEY`: Your Perplexity API key for research-backed subtask generation
*   `PERPLEXITY_MODEL`: Specify which Perplexity model to use (default: "sonar-medium-online")
*   `DEBUG`: Enable debug logging (default: false)
*   `LOG_LEVEL`: Log level - debug, info, warn, error (default: info)
*   `DEFAULT_SUBTASKS`: Default number of subtasks when expanding (default: 3)
*   `DEFAULT_PRIORITY`: Default priority for generated tasks (default: medium)
*   `PROJECT_NAME`: Override default project name in tasks.json
*   `PROJECT_VERSION`: Override default version in tasks.json

If you are using OpenRouter as your AI provider, you need to set the `OPENROUTER_API_KEY` environment variable and specify the `--ai-provider=openrouter` option when running the Task Master CLI commands.

### Usage Examples

Here are some examples of how to use the Task Master CLI commands to manage tasks:

*   **Parse a PRD file and generate tasks:**

    ```bash
    task-master parse-prd your-prd.txt --ai-provider=openrouter
    ```

*   **List all tasks:**

    ```bash
    task-master list
    ```

*   **Show the next task to work on:**

    ```bash
    task-master next
    ```

*   **Generate task files:**

    ```bash
    task-master generate
    ```

*   **Expand a task into subtasks:**

    ```bash
    task-master expand --id=1 --num=3 --ai-provider=openrouter
    ```

*   **Set the status of a task:**

    ```bash
    task-master set-status --id=1 --status=done
    ```


## Code Overview

`index.js` is the main entry point for the `task-master` CLI, providing commands like `init`, `list`, `next`, and `generate`. It also exports functions for programmatic use.

`bin/task-master.js` serves as the main entry point for the globally installed `task-master` CLI, mirroring the commands available in `index.js` but with more detailed option handling. It essentially acts as a wrapper around the `dev.js` script, providing a user-friendly command-line interface.


Other .md files provide additional context:

- [scripts/README.md (and assets/scripts\_README.md)](#scriptsreadmeand-assetsscripts_readmemd): Provides in-depth documentation of the `dev.js` script, including all commands and options. This is more technical and developer-focused.
- [tests/README.md](#testsreadmemd): Describes the testing strategy and how to run tests.


## Requirements

### System Requirements
- **Node.js 14.0.0 or higher** (recommended: LTS version)
- **npm** (comes with Node.js) or **yarn**

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Linux (RHEL/CentOS):**
```bash
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs
```

**macOS (using Homebrew):**
```bash
brew install node
```

**Windows:**
Download installer from [Node.js official website](https://nodejs.org/)

**Verify Installation:**
```bash
node --version
npm --version
```

### API Requirements
- Anthropic API key (Claude API)
- Anthropic SDK version 0.39.0 or higher
- OpenAI SDK (for Perplexity API integration, optional)

## Installation

```bash
# Install globally
npm install -g task-master-ai

# OR install locally within your project
npm install task-master-ai
```

### Initialize a new project

```bash
# If installed globally
task-master init

# Parse a PRD and generate tasks
task-master parse-prd your-prd.txt

# List all tasks
task-master list

# Show the next task to work on
task-master next

# Generate task files
task-master generate
```




## Task Structure

Tasks in tasks.json have the following structure:

- `id`: Unique identifier for the task (Example: `1`)
- `title`: Brief, descriptive title of the task (Example: `"Initialize Repo"`)
- `description`: Concise description of what the task involves (Example: `"Create a new repository, set up initial structure."`)
- `status`: Current state of the task (Example: `"pending"`, `"done"`, `"deferred"`)
- `dependencies`: IDs of tasks that must be completed before this task (Example: `[1, 2]`)
  - Dependencies are displayed with status indicators (✅ for completed, ⏱️ for pending)
  - This helps quickly identify which prerequisite tasks are blocking work
- `priority`: Importance level of the task (Example: `"high"`, `"medium"`, `"low"`)
- `details`: In-depth implementation instructions (Example: `"Use GitHub client ID/secret, handle callback, set session token."`)
- `testStrategy`: Verification approach (Example: `"Deploy and call endpoint to confirm 'Hello World' response."`)
- `subtasks`: List of smaller, more specific tasks that make up the main task (Example: `[{"id": 1, "title": "Configure OAuth", ...}]`)

## AI-Driven Development Workflow

The Cursor agent is pre-configured (via the rules file) to follow this workflow:

### 1. Task Discovery and Selection

Ask the agent to list available tasks:

```
What tasks are available to work on next?
```

The agent will:
- Run `task-master list` to see all tasks
- Run `task-master next` to determine the next task to work on
- Analyze dependencies to determine which tasks are ready to be worked on
- Prioritize tasks based on priority level and ID order
- Suggest the next task(s) to implement

### 2. Task Implementation

When implementing a task, the agent will:
- Reference the task's details section for implementation specifics
- Consider dependencies on previous tasks
- Follow the project's coding standards
- Create appropriate tests based on the task's testStrategy

You can ask:
```
Let's implement task 3. What does it involve?
```

### 3. Task Verification

Before marking a task as complete, verify it according to:
- The task's specified testStrategy
- Any automated tests in the codebase
- Manual verification if required

### 4. Task Completion

When a task is completed, tell the agent:

```
Task 3 is now complete. Please update its status.
```

The agent will execute:
```bash
task-master set-status --id=3 --status=done
```

### 5. Handling Implementation Drift

If during implementation, you discover that:
- The current approach differs significantly from what was planned
- Future tasks need to be modified due to current implementation choices
- New dependencies or requirements have emerged

Tell the agent:
```
We've changed our approach. We're now using Express instead of Fastify. Please update all future tasks to reflect this change.
```

The agent will execute:
```bash
task-master update --from=4 --prompt="Now we are using Express instead of Fastify."
```

This will rewrite or re-scope subsequent tasks in tasks.json while preserving completed work.

### 6. Breaking Down Complex Tasks

For complex tasks that need more granularity:

```
Task 5 seems complex. Can you break it down into subtasks?
```

The agent will execute:
```bash
task-master expand --id=5 --num=3
```

You can provide additional context:
```
Please break down task 5 with a focus on security considerations.
```

The agent will execute:
```bash
task-master expand --id=5 --prompt="Focus on security aspects"
```

You can also expand all pending tasks:
```
Please break down all pending tasks into subtasks.
```

The agent will execute:
```bash
task-master expand --all
```

For research-backed subtask generation using Perplexity AI:
```
Please break down task 5 using research-backed generation.
```

The agent will execute:
```bash
task-master expand --id=5 --research
```

## Command Reference

Here's a comprehensive reference of all available commands:

### Parse PRD
```bash
# Parse a PRD file and generate tasks
task-master parse-prd <prd-file.txt>

# Limit the number of tasks generated
task-master parse-prd <prd-file.txt> --num-tasks=10

# Specify the AI provider (openai or openrouter)
task-master parse-prd <prd-file.txt> --ai-provider=openrouter
```

### List Tasks
```bash
# List all tasks
task-master list

# List tasks with a specific status
task-master list --status=<status>

# List tasks with subtasks
task-master list --with-subtasks

# List tasks with a specific status and include subtasks
task-master list --status=<status> --with-subtasks
```

### Show Next Task
```bash
# Show the next task to work on based on dependencies and status
task-master next
```

### Show Specific Task
```bash
# Show details of a specific task
task-master show <id>
# or
task-master show --id=<id>

# View a specific subtask (e.g., subtask 2 of task 1)
task-master show 1.2
```

### Update Tasks
```bash
# Update tasks from a specific ID and provide context
task-master update --from=<id> --prompt="<prompt>"
```

### Generate Task Files
```bash
# Generate individual task files from tasks.json
task-master generate
```

### Set Task Status
```bash
# Set status of a single task
task-master set-status --id=<id> --status=<status>

# Set status for multiple tasks
task-master set-status --id=1,2,3 --status=<status>

# Set status for subtasks
task-master set-status --id=1.1,1.2 --status=<status>
```

When marking a task as "done", all of its subtasks will automatically be marked as "done" as well.

### Expand Tasks
```bash
# Expand a specific task with subtasks
task-master expand --id=<id> --num=<number>

# Expand with additional context
task-master expand --id=<id> --prompt="<context>"

# Expand all pending tasks
task-master expand --all

# Force regeneration of subtasks for tasks that already have them
task-master expand --all --force

# Research-backed subtask generation for a specific task
task-master expand --id=<id> --research

# Research-backed generation for all tasks
task-master expand --all --research
```

### Clear Subtasks
```bash
# Clear subtasks from a specific task
task-master clear-subtasks --id=<id>

# Clear subtasks from multiple tasks
task-master clear-subtasks --id=1,2,3
# Clear subtasks from all tasks
task-master clear-subtasks --all
```

### Analyze Task Complexity
```bash
# Analyze complexity of all tasks
task-master analyze-complexity

# Save report to a custom location
task-master analyze-complexity --output=my-report.json

# Use a specific LLM model
task-master analyze-complexity --model=claude-3-opus-20240229

# Set a custom complexity threshold (1-10)
task-master analyze-complexity --threshold=6

# Use an alternative tasks file
task-master analyze-complexity --file=custom-tasks.json

# Use Perplexity AI for research-backed complexity analysis
task-master analyze-complexity --research
```

### View Complexity Report
```bash
# Display the task complexity analysis report
task-master complexity-report

# View a report at a custom location
task-master complexity-report --file=my-report.json
```

### Managing Task Dependencies
```bash
# Add a dependency to a task
task-master add-dependency --id=<id> --depends-on=<id>

# Remove a dependency from a task
task-master remove-dependency --id=<id> --depends-on=<id>

# Validate dependencies without fixing them
task-master validate-dependencies

# Find and fix invalid dependencies automatically
task-master fix-dependencies
```

### Add a New Task
```bash
# Add a new task using AI
task-master add-task --prompt="Description of the new task"

# Add a task with dependencies
task-master add-task --prompt="Description" --dependencies=1,2,3

# Add a task with priority
task-master add-task --prompt="Description" --priority=high
```

## Feature Details

### Analyzing Task Complexity

The `analyze-complexity` command:
- Analyzes each task using AI to assess its complexity on a scale of 1-10
- Recommends optimal number of subtasks based on configured DEFAULT_SUBTASKS
- Generates tailored prompts for expanding each task
- Creates a comprehensive JSON report with ready-to-use commands
- Saves the report to scripts/task-complexity-report.json by default

The generated report contains:
- Complexity analysis for each task (scored 1-10)
- Recommended number of subtasks based on complexity
- AI-generated expansion prompts customized for each task
- Ready-to-run expansion commands directly within each task analysis

### Viewing Complexity Report

The `complexity-report` command:
- Displays a formatted, easy-to-read version of the complexity analysis report
- Shows tasks organized by complexity score (highest to lowest)
- Provides complexity distribution statistics (low, medium, high)
- Highlights tasks recommended for expansion based on threshold score
- Includes ready-to-use expansion commands for each complex task
- If no report exists, offers to generate one on the spot

### Smart Task Expansion

The `expand` command automatically checks for and uses the complexity report:

When a complexity report exists:
- Tasks are automatically expanded using the recommended subtask count and prompts
- When expanding all tasks, they're processed in order of complexity (highest first)
- Research-backed generation is preserved from the complexity analysis
- You can still override recommendations with explicit command-line options

Example workflow:
```bash
# Generate the complexity analysis report with research capabilities
task-master analyze-complexity --research

# Review the report in a readable format
task-master complexity-report

# Expand tasks using the optimized recommendations
task-master expand --id=8
# or expand all tasks
task-master expand --all
```

### Finding the Next Task

The `next` command:
- Identifies tasks that are pending/in-progress and have all dependencies satisfied
- Prioritizes tasks based on priority level, dependency count, and task ID
- Displays comprehensive information about the selected task:
  - Basic task details (ID, title, priority, dependencies)
  - Implementation details
  - Subtasks (if they exist)
- Provides contextual action suggestions:
  - Command to mark the task as in-progress
  - Command to mark the task as done
  - Commands for working with subtasks

### Viewing Specific Task Details

The `show` command:
- Displays comprehensive details about a specific task or subtask
- Shows task status, priority, dependencies, and detailed implementation notes
- For parent tasks, displays all subtasks and their status
- For subtasks, shows parent task relationship
- Provides contextual action suggestions based on the task's state
- Works with both regular tasks and subtasks (using the format taskId.subtaskId)

## Best Practices for AI-Driven Development

1.  **Start with a detailed PRD**: The more detailed your PRD, the better the generated tasks will be.
2.  **Review generated tasks**: After parsing the PRD, review the tasks to ensure they make sense and have appropriate dependencies.
3.  **Analyze task complexity**: Use the complexity analysis feature to identify which tasks should be broken down further.
4.  **Follow the dependency chain**: Always respect task dependencies - the Cursor agent will help with this.
5.  **Update as you go**: If your implementation diverges from the plan, use the update command to keep future tasks aligned with your current approach.
6.  **Break down complex tasks**: Use the expand command to break down complex tasks into manageable subtasks.
7.  **Regenerate task files**: After any updates to tasks.json, regenerate the task files to keep them in sync.
8.  **Communicate context to the agent**: When asking the Cursor agent to help with a task, provide context about what you're trying to achieve.
9. Validate dependencies**: Periodically run the validate-dependencies command to check for invalid or circular dependencies.


## Troubleshooting

### If `task-master init` doesn't respond:

Try running it with Node directly:

```bash
node node_modules/claude-task-master/scripts/init.js
```

Or clone the repository and run:

```bash
git clone https://github.com/eyaltoledano/claude-task-master.git
cd claude-task-master
node scripts/init.js
```


If you encounter any issues while using Task Master AI with Cline, please check the following:

*   Make sure that you have installed Task Master AI correctly.
*   Make sure that you have set the required environment variables.
*   Make sure that you are using a valid model ID for the OpenRouter API.
*   Make sure that you have internet connectivity.