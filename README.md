# Task Master

[![CI](https://github.com/eyaltoledano/claude-task-master/actions/workflows/ci.yml/badge.svg)](https://github.com/eyaltoledano/claude-task-master/actions/workflows/ci.yml)
[![License: MIT with Commons Clause](https://img.shields.io/badge/license-MIT%20with%20Commons%20Clause-blue.svg)](LICENSE)
[![npm version](https://badge.fury.io/js/task-master-ai.svg)](https://badge.fury.io/js/task-master-ai)

### by [@eyaltoledano](https://x.com/eyaltoledano)

A task management system for AI-driven development with Claude, designed to work seamlessly with Cursor AI. This project includes both core task management features and a powerful PRD (Product Requirements Document) generation workflow.

## Licensing

Task Master is licensed under the MIT License with Commons Clause. This means you can:

✅ **Allowed**:

- Use Task Master for any purpose (personal, commercial, academic)
- Modify the code
- Distribute copies
- Create and sell products built using Task Master

❌ **Not Allowed**:

- Sell Task Master itself
- Offer Task Master as a hosted service
- Create competing products based on Task Master

See the [LICENSE](LICENSE) file for the complete license text.

## Requirements

- Node.js 14.0.0 or higher
- Anthropic API key (Claude API) - Required for AI features.
- Anthropic SDK version 0.39.0 or higher
- OpenAI SDK (for Perplexity API integration, optional)

## Configuration

The script can be configured through environment variables in a `.env` file at the root of the `claude-task-master` directory:

### Required Configuration

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude

### Optional Configuration

- `MODEL`: Specify which Claude model to use (default: "claude-3-7-sonnet-20250219")
- `MAX_TOKENS`: Maximum tokens for model responses (default: 4000)
- `TEMPERATURE`: Temperature for model responses (default: 0.7)
- `PERPLEXITY_API_KEY`: Your Perplexity API key for research-backed features (optional)
- `PERPLEXITY_MODEL`: Specify which Perplexity model to use (default: "sonar-medium-online")
- `DEBUG`: Enable debug logging (default: false)
- `LOG_LEVEL`: Log level - debug, info, warn, error (default: info)
- `DEFAULT_SUBTASKS`: Default number of subtasks when expanding (default: 3)
- `DEFAULT_PRIORITY`: Default priority for generated tasks (default: medium)
- `PROJECT_NAME`: Override default project name in tasks.json
- `PROJECT_VERSION`: Override default version in tasks.json

## Installation

```bash
# Clone the repository
git clone https://github.com/Zyra-V23/claude-task-master.git
cd claude-task-master

# Install dependencies
npm install

# Create a .env file in this directory and add your ANTHROPIC_API_KEY
echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
```

## Core Task Management Commands

These commands help manage development tasks generated from a PRD.

```bash
# Initialize a new project structure (run from parent directory if needed)
# node scripts/init.js # Currently requires separate execution

# Parse a PRD and generate tasks
node scripts/dev.js parse-prd your-prd.txt

# List all tasks
node scripts/dev.js list

# Show the next task to work on based on dependencies and status
node scripts/dev.js next

# Generate individual task files (e.g., tasks/task_001.txt)
node scripts/dev.js generate

# Show details for a specific task
node scripts/dev.js show <task_id>

# Set the status of one or more tasks
node scripts/dev.js set-status --id <task_id(s)> --status <status>

# Expand a task into subtasks using AI
node scripts/dev.js expand --id <task_id> [--num <number>] [--research] [--prompt <text>]

# Add a dependency between tasks
node scripts/dev.js add-dependency --id <task_id> --depends-on <dependency_id>

# Analyze task complexity for expansion recommendations
node scripts/dev.js analyze-complexity

# Add a subtask to a parent task
node scripts/dev.js add-subtask --parent <parent_id> --title "Subtask Title" ...
```

## PRD Generation Workflow Commands

This workflow uses AI to help generate a Product Requirements Document (PRD) from an initial idea.

### Workflow Overview

1.  **`ideate`**: Takes a basic idea and expands it into a structured product concept document.
2.  **`round-table`**: Simulates a discussion between AI experts (e.g., Product Manager, Engineer, Designer) based on the concept to identify potential issues, challenges, and improvements. Generates a discussion transcript.
3.  **`refine-concept`**: Refines the original concept document using insights from the round-table discussion transcript and/or custom text prompts.
4.  **`generate-prd`**: Generates the final PRD document from the refined concept, optionally using a template.

Commands can be run sequentially (often prompting to proceed to the next step automatically) or individually by providing the necessary file paths as options.

### Command Details

1.  **`node scripts/dev.js ideate [options]`**: Transforms an initial idea into a structured concept.
    *   Flags:
        *   `-i, --idea <text>`: The initial idea (if not provided, it will be requested interactively).
        *   `-o, --output <file>`: Output file for the concept (default: `prd/concept.txt`).
        *   `-r, --research`: Enable research-backed generation (optional).
    *   Flow:
        *   Takes the idea (flag or interactive).
        *   Generates a concept document with sections (e.g., Problem, Solution, Objectives, Features).
        *   Handles existing output files (prompts for Overwrite/New/Cancel).
        *   Saves to the specified file (or timestamped if "New" chosen).
        *   **Interactively asks if you want to proceed to `round-table`**.

2.  **`node scripts/dev.js round-table [options]`**: Simulates an expert discussion about the concept.
    *   Flags:
        *   `-c, --concept-file <file>`: Path to the concept file (default: `prd/concept.txt`).
        *   `-o, --output <file>`: Output file for the transcript (default: `prd/discussion.txt`).
        *   `-p, --participants <list>`: Comma-separated list of expert roles (interactive if not provided).
        *   `--topics <list>`: Comma-separated list of specific topics to include (interactive if not provided).
        *   `--focus-topics`: Indicates discussion should focus primarily on provided topics (interactive if not specified).
    *   Flow:
        *   Handles existing output files.
        *   Reads the concept file.
        *   Prompts for participants and topics if not specified.
        *   Simulates the discussion using AI and saves the transcript.
        *   **Interactively asks if you want to proceed to `refine-concept`**.

3.  **`node scripts/dev.js refine-concept [options]`**: Refines the concept based on discussion and/or prompts.
    *   Flags:
        *   `-c, --concept-file <file>`: Path to the concept file to refine (**required**).
        *   `-d, --discussion-file <file>`: Path to the discussion transcript to use as input.
        *   `-p, --prompt <text>`: Custom text prompt to guide refinement.
        *   `-o, --output <file>`: Output file for the refined concept (default: `<concept_file>_refined.txt`).
    *   Flow:
        *   Requires either a discussion file (`-d`) or a custom prompt (`-p`), or both.
        *   Prompts interactively for missing required inputs.
        *   Generates a refined concept using AI.
        *   Saves the refined concept.
        *   **Interactively asks if you want to proceed to `generate-prd`**.

4.  **`node scripts/dev.js generate-prd [options]`**: Generates the final PRD document.
    *   Flags:
        *   `-c, --concept-file <file>`: Path to the concept file (usually the refined one).
        *   `-t, --template <file>`: Path to an optional PRD template file.
        *   `-r, --research`: Enable research-backed generation.
        *   `-o, --output <file>`: Output file path for the PRD (default: `prd/prd.txt`).
        *   `--format <format>`: Output format (markdown, plaintext; default: markdown).
        *   `--style <style>`: Detail level (minimal, standard, detailed; default: standard).
        *   `--sections <list>`: Comma-separated list of sections to include.
        *   `--preview`: Show a preview before generating (feature may be basic).
        *   `-y, --yes`: Skip preview confirmation.
    *   Flow:
        *   Prompts interactively for missing required inputs.
        *   Generates PRD content using AI based on options.
        *   Handles preview if requested.
        *   Saves the final PRD.
        *   **Automatically generates/updates `.cursor/mcp_generatedfromprd.json`** for MCP server integration.

## Task Structure

Tasks in `tasks/tasks.json` have the following structure:

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

## Integrating with Cursor AI

Claude Task Master is designed to work seamlessly with [Cursor AI](https://www.cursor.so/), providing a structured workflow for AI-driven development.

### Setup with Cursor

1.  Clone this repository and install dependencies as described above.
2.  After initializing your project and potentially generating a PRD, open the `claude-task-master` folder in Cursor.
3.  The `.cursor/rules/dev_workflow.mdc` file (if present and configured) can provide the AI with knowledge about the task management system.
4.  The `.cursor/mcp_generatedfromprd.json` file (generated by `generate-prd`) tells Cursor how to start the project's internal MCP server.
5.  Open Cursor's AI chat and switch to Agent mode.

### Using the Internal MCP Server with Cursor

This project includes its own MCP server implementation (`mcp-server/server.js`) for tighter integration.

1.  **Automatic Configuration:** The `.cursor/mcp_generatedfromprd.json` file (created by `generate-prd`) tells Cursor how to launch this project's specific MCP server.
2.  **Starting the Server:** Cursor will automatically start the server (`node ./mcp-server/server.js`) when needed based on the configuration file.
3.  **Interacting:** You can use Cursor's MCP interface (e.g., the "MCP" tab) or AI agent prompts to interact with the tools *currently exposed* by the `mcp-server`. This includes basic task management tools like `listTasks`, `showTask`, `setTaskStatus`, etc.

**Note:** The PRD workflow commands (`ideate`, `round-table`, `refine-concept`, `generate-prd`) are **not yet implemented as MCP tools** within the `mcp-server`. They currently only work via the direct CLI (`node scripts/dev.js ...`). Adding these tools to the `mcp-server` would require creating corresponding tool files in `mcp-server/src/tools/` and registering them.

### AI-Driven Development Workflow Example

#### 1. PRD Generation (via CLI)

Use the CLI commands (`ideate`, `round-table`, etc.) directly or instruct the Cursor agent to run them in the terminal:

```
Run the ideate command with the idea "An AI assistant for cooking recipes".
Okay, now run the round-table command using the concept file generated.
Now, refine the concept using the discussion and the prompt "Focus on international cuisine".
Finally, generate the PRD from the refined concept.
```

#### 2. Task Generation from PRD (via CLI)

```
Please use the task-master parse-prd command to generate tasks from the PRD located at prd/prd.txt.
```
Agent executes: `node scripts/dev.js parse-prd prd/prd.txt`

#### 3. Generate Individual Task Files (via CLI)

```
Please generate individual task files from tasks.json
```
Agent executes: `node scripts/dev.js generate`

The agent will execute:

```bash
node scripts/dev.js generate
```

#### 4. Task Management (via CLI or potentially MCP)

Once tasks are generated, you can manage them:

```
What tasks are available to work on next? (Agent might use `list` and `next` CLI commands or MCP tools if available)
Show me the details for task 5. (Agent might use `show 5` CLI or MCP tool)
Mark task 5 as done. (Agent might use `set-status --id 5 --status done` CLI or MCP tool)
```

## Troubleshooting

### Module Not Found Errors

- Ensure you are running `node scripts/dev.js ...` commands from *within* the `claude-task-master` directory.
- Make sure you have run `npm install` after cloning.

### Command Not Found

- If using global commands (`task-master ...`), ensure the global installation was successful (`npm install -g task-master-ai`).
- If running locally, use `node scripts/dev.js <command>`.
- Make sure you have run `npm install`.

Unit tests should be generated to mock the functionality using tests.mdc

### API Key Errors

- Verify your `ANTHROPIC_API_KEY` is correctly set in the `.env` file within the `claude-task-master` directory.
