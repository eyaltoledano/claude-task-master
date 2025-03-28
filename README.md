# Introducing AI Task Master ✨

## A CLI that turns your Project's Documentation into an autonomous local task management and project implementation system.
### Initially developped for Cline with Anthropic's Claude by [@eyaltoledano](https://x.com/eyaltoledano)
### Forked by [@JamesCherished](https://x.com/JamesCherished) to work with Roo Code and Cline.

## Use this repository

### [Cursor](https://github.com/James-Cherished-Inc/AI-task-master/tree/cursor) branch : aims to be up-to-date with the latest releases by [@eyaltoledano](https://x.com/eyaltoledano) at [eyaltoledano/claude-task-master/main](https://github.com/eyaltoledano/claude-task-master).

### Roo Code

#### [Roo Code as a Custom Mode](https://github.com/James-Cherished-Inc/AI-task-master/tree/roo-as-custom-mode) branch : fork of [eyaltoledano/claude-task-master/main](https://github.com/eyaltoledano/claude-task-master) working with Roo by creating a Roo Custom Mode with the prompts in [Task Master Prompts.md](https://github.com/James-Cherished-Inc/AI-task-master/blob/roo-as-custom-mode/Task%20Master%20Prompts.md), using task-master as is ('npm i task-master-ai').

#### [Roo Code AI Task Master](https://github.com/James-Cherished-Inc/AI-task-master/tree/Roo-AI-Task-Master) branch (preferred) : custom package modified specifically for Roo Code, to 'git clone' and run locally with ('npm install').
Can be used with the Roo Custom Mode *(with the prompts in [Task Master Prompts.md](https://github.com/James-Cherished-Inc/AI-task-master/blob/roo-as-custom-mode/Task%20Master%20Prompts.md) )*

#### [Roo Code for OpenRouter](https://github.com/James-Cherished-Inc/AI-task-master/tree/Roo%2BOpenRouter) branch : this repo enables the choice to use OpenRouter as replacement for Anthropic's Claude and/or Perplexity's Sonar at the user will, by setting the default provider and API in the .env. 

Benefits:
- More reliable API access
- Better rate limits
- Consistent performance
- Lower costs and better caching
- 50+ free models
- most SOTA models

### [Cline](https://github.com/James-Cherished-Inc/AI-task-master/tree/cline) branch : this repo enables the use of [eyaltoledano/claude-task-master/main](https://github.com/eyaltoledano/claude-task-master) for Cline. Further implementation will be made soon. But I recommend you try out Roo Code anyway instead, (at least for now ;)


## Graduate from building cute little apps to ambitious projects without overwhelming yourself or the agent.

![Image](https://pbs.twimg.com/media/GmoQ0epa8AAXf8-.jpg)

A custom script that intelligently breaks down massive PRDs into clear, ordered, dependency-aware tasks:
• Reliable, sequential implementation
• Eliminates overwhelm/boosts clarity

![Image](https://pbs.twimg.com/media/GmoRWjYWcAA5mC9.jpg)


---
- [Task Master](#task-master)
- [Table of Contents:](#table-of-contents)
- [QuickStart - How to Use](#quickstart---how-to-use)
    - [HINT : There's only 1 simple thing to do](#why-so-easy)
    - [Architect Mode? Code Mode? Both at the same time.](#architect-mode-code-mode-both-at-the-same-time)
    - [PRD? Plans?](#prd-plans)
    - [Commands](#commands)
    - [Create AI Task Master Custom Mode - How?](#create-ai-task-master-custom-mode---how)
- [Task Master AI Docs](#task-master%20AI%20Docs)
    - [Installation](#installation)
    - [Understanding Main Commands Workflow](#understanding-main-commands-workflow)
	- [Configuration](#configuration)
	- [Script Overview](#script-overview)
	- [Requirements](#requirements)
	    - [Important Notes](#important-notes)
	- [Workflow for AI-Driven Development](#workflow-for-ai-driven-development)
	    - [1. Task Discovery and Selection](#1-task-discovery-and-selection)
	    - [2. Task Implementation](#2-task-implementation)
	    - [3. Task Verification](#3-task-verification)
	    - [4. Task Completion](#4-task-completion)
	    - [5. Handling Implementation Drift](#5-handling-implementation-drift)
	    - [6. Breaking Down Complex Tasks](#6-breaking-down-complex-tasks)
	- [Command Reference](#command-reference)
	    - [Parse PRD](#parse-prd)
	    - [List Tasks](#list-tasks)
	    - [Show Next Task](#show-next-task)
	    - [Show Specific Task](#show-specific-task)
	    - [Update Tasks](#update-tasks)
	    - [Generate Task Files](#generate-task-files)
	    - [Set Task Status](#set-task-status)
	    - [Expand Tasks](#expand-tasks)
	    - [Clear Subtasks](#clear-subtasks)
	    - [Analyze Task Complexity](#analyze-task-complexity)
	    - [View Complexity Report](#view-complexity-report)
	    - [Managing Task Dependencies](#managing-task-dependencies)
	    - [Add a New Task](#add-a-new-task)
	- [Feature Details](#feature-details)
	    - [Analyzing Task Complexity](#analyzing-task-complexity)
	    - [Viewing Complexity Report](#viewing-complexity-report)
	    - [Smart Task Expansion](#smart-task-expansion)
	    - [Finding the Next Task](#finding-the-next-task)
	    - [Viewing Specific Task Details](#viewing-specific-task-details)
	- [Best Practices for AI-Driven Development](#best-practices-for-ai-driven-development)
	- [Examples](#examples)
	    - [Starting a new project](#starting-a-new-project)
	    - [Working on tasks](#working-on-tasks)
	    - [Implementing a specific task](#implementing-a-specific-task)
	    - [Managing subtasks](#managing-subtasks)
	    - [Handling changes](#handling-changes)
	    - [Completing work](#completing-work)
	    - [Analyzing complexity](#analyzing-complexity)
	    - [Viewing complexity report](#viewing-complexity-report)
	- [Task Structure](#task-structure)
	- [Troubleshooting](#troubleshooting)
	    - [If task-master init doesn't respond:](#if-task-master-init-doesnt-respond)
---
# QuickStart - How to Use

To start using Roo-AI Task Master, follow these steps:

1.  **Clone the repository:** Clone the forked repository to your local machine and open it in your terminal.
2.  **Install dependencies:** Run `npm install` (or `yarn install` or `pnpm install`) to install the project's dependencies.
3. **Create a Roo Custom Code** from the extension by copy/pasting the prompts in Task Master Prompts.md or downloading .clinerules-taskmaster and moving it to the .vscode directory

4. *(optional)* : **Set up your API keys** in the .env created after you run npm install
(Only if you want to use AI to parse your PRD and to deep research tasks ; Roo can also work without these features)

That's it!
Now open an existing or new workspace and **start chatting with Roo!** (Don't forget to select the Task-Master mode)

![alt text](image-1.png)


*Note : if no API keys are set, certain terminal commands won't work (like parse), but Roo will continue working despite the failed commands, and it won't affect the end result that much.*


### Why so easy?

Roo will use the 'npm i task-master-ai' and 'roo-task-master init' commands as it understands you're starting a new project.
The Custom Mode now programs Roo to use the task-master script to autonomously create, track, edit and close tasks and subtasks, based on the plan you decide together or already wrote in your Readme.me or project's documentation.
It's probably best you state clearly this is a new project in the 1st Roo task prompt.

For the next tasks, it won't run these commands as it understands you're working on an existing project.
If you want to try AI Task Master on an existing project, just tell Roo. You can also run the commands yourself. You can run npm i -g  task-master-ai to install AI Task Master globally ; by default, Roo only installs it within your project.
Roo always starts a new Roo task with task-master list to check if there's already a plan to resume. It's probably best you state it's an already existing project, already using task-master if that's the case, in the 1st Roo task prompt.

### Architect Mode? Code Mode? Both at the same time.

You don't need to use Architect mode anymore, as it is embedded in this custom mode :
It is automatically enabled at the beginning of a Roo task if there is no documentation or task implementation plan in your prompt or project documentation, to create one for you to review. You can tweak it, refine it, or detail it by prompting. Once you accept, Roo gets to work right away, as if it was in Code mode.
If Roo finds documentation or plans when you starts its Roo task, it automotically gets to work, either resuming AI Task Master tasks, or setting it up accordingly.

### PRD? Plans?

A PRD is a Products Requirements Documentation text file for complex projects. Task Master is able to work with dense PRD, but in this implementation, **it can also work with just a Readme** or anything your write in /docs.
If you start your project from scratch, Roo Code will guide you through creating your project's documentation automatically. I invite you to approach the project designing phase as a collaborative brainstorming.

### Commands

Roo has access to all the Task Master CLI commands in his prompt and knows where to use which, autonomously.
You are free to run any of these commands in you terminal yourself at anytime without informing Roo.
The full list of these commands is written below, as we resume the original README from [@eyaltoledano](https://x.com/eyaltoledano).


## API Provider Setup Setting up .env

To configure your API providers, add at least Claude or Openrouter.
Then, you can add Perplexity if you want.
OpenRouter configuration can replace Perplexity for research if Perplexity is not setup, or commented out.


### 1. Using Anthropic (Claude API)
1. Get your API key from https://console.anthropic.com
2. Add to .env:
```
ANTHROPIC_API_KEY=your_api_key_here
AI_PROVIDER=CLAUDE
```

### 2. Using Perplexity API
1. Get your API key from https://www.perplexity.ai
2. Add to .env:
```
PERPLEXITY_API_KEY=your_api_key_here
AI_PROVIDER=PERPLEXITY
```

### 3. Using OpenRouter (supports multiple models)
1. Get your API key from https://openrouter.ai
2. Add to .env:
```
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_PARSING_MODEL=anthropic/claude-3-sonnet  # Model for task parsing
OPENROUTER_RESEARCH_MODEL=anthropic/claude-3-sonnet # Model for research tasks
AI_PROVIDER=OPENROUTER
```

Note: If no AI_PROVIDER is specified, OpenRouter will be used by default when its API key is present.

Benefits:
- More reliable API access
- Better rate limits
- Consistent performance
- Lower costs and better caching
- 50+ free models
- most SOTA models

## OpenRouter specific commands

The current implementation hardcodes Claude, if you want to use OpenRouter instead, you may need to specify it when running the commands. With the most advanced model Roo checks which provider is set in .env by you to know when to use OpenRouter-specific commands. Don't hesitate to remind him if needed.

#### OpenRouter PRD Parsing
To parse PRDs using OpenRouter:
```bash
OPENROUTER_API_KEY=your_key_here npm run parse-prd-openrouter path/to/prd.txt
```
### `npm run expand-research` for research-backed task expansion

### `npm run analyze-complexity-research` for research-backed complexity analysis



### Create AI Task Master Custom Mode - How?

You have 2 options
- Download .clinerules-task-master from this repo and add it to your Roo extension settings in .vscode
- Copy the prompts at the end of this README to create the custom mode yourself (preferred), and tweak it if you want

![alt text](image-1.png)

---

# Task Master AI Docs

### Installation

```bash
# Install globally
npm i -g task-master-ai

# OR install locally within your project
npm i task-master-ai
```

### Initialize a new project

```bash
# If installed globally
task-master init

# If installed locally
npx task-master-init
```

This will prompt you for project details and set up a new project with the necessary files and structure.

### Understanding Main Commands Workflow

After installing the package globally, you can use these CLI commands from any directory:

```bash
# Initialize a new project
task-master init

# Parse a PRD and generate tasks
task-master parse-prd your-prd.txt

This will:
- Parse your PRD document
- Generate a structured `tasks.json` file with tasks, dependencies, priorities, and test strategies
- The agent will understand this process due to the Cursor rules


# List all tasks
task-master list

# Show the next task to work on
task-master next

# Generate task files
task-master generate
```

```bash
task-master generate
```


### Configuration

The script can be configured through environment variables in a `.env` file at the root of the project:

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude
- `MODEL`: Specify which Claude model to use (default: "claude-3-7-sonnet-20250219")
- `MAX_TOKENS`: Maximum tokens for model responses (default: 4000)
- `TEMPERATURE`: Temperature for model responses (default: 0.7)
- `PERPLEXITY_API_KEY`: Your Perplexity API key for research-backed subtask generation
- `PERPLEXITY_MODEL`: Specify which Perplexity model to use (default: "sonar-medium-online")
- `DEBUG`: Enable debug logging (default: false)
- `LOG_LEVEL`: Log level - debug, info, warn, error (default: info)
- `DEFAULT_SUBTASKS`: Default number of subtasks when expanding (default: 3)
- `DEFAULT_PRIORITY`: Default priority for generated tasks (default: medium)
- `PROJECT_NAME`: Override default project name in tasks.json
- `PROJECT_VERSION`: Override default version in tasks.json


### Script Overview

`index.js` is the main entry point for the `task-master` CLI, providing commands like `init`, `list`, `next`, and `generate`. It also exports functions for programmatic use.

`bin/task-master.js` serves as the main entry point for the globally installed `task-master` CLI, mirroring the commands available in `index.js` but with more detailed option handling. It essentially acts as a wrapper around the `dev.js` script, providing a user-friendly command-line interface.

Other .md files provide additional context:

- [scripts/README.md (and assets/scripts\_README.md)](#scriptsreadmeand-assetsscripts_readmemd): Provides in-depth documentation of the `dev.js` script, including all commands and options. This is more technical and developer-focused.
- [tests/README.md](#testsreadmemd): Describes the testing strategy and how to run tests.

### Requirements

#### System Requirements
- **Node.js 14.0.0 or higher** (recommended: LTS version)
- **npm** (comes with Node.js) or **yarn**

##### Requirements Installation Instructions:

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

#### API (Optional, Needed for Research and Parsing)
- OpenRouter API
- Anthropic API key (Claude API)
- Anthropic SDK version 0.39.0 or higher
- OpenAI SDK (for Perplexity API integration, optional)

#### Important Notes

1.  This package uses ES modules. Your package.json should include `"type": "module"`.
2.  The Anthropic SDK version should be 0.39.0 or higher.


## Workflow for AI-Driven Development 

The agent is pre-configured (via the rules file) to follow this workflow:

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
For research-backed subtask generation:
```
Please break down task 5 using research-backed generation.
```

The agent will execute:
```bash
# Using Perplexity (default)
task-master expand --id=5 --research

# Using OpenRouter alternative
OPENROUTER_API_KEY=your_key_here npm run expand-research -- --expand --id=5
```
```

## Command Reference

Here's a comprehensive reference of all available commands:

### Parse PRD
```bash
# Parse a PRD file and generate tasks
task-master parse-prd <prd-file.txt>

# Limit the number of tasks generated
task-master parse-prd <prd-file.txt> --num-tasks=10
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

# Use AI for research-backed complexity analysis
```bash
# Using Perplexity (default)
task-master analyze-complexity --research

# Using OpenRouter alternative
OPENROUTER_API_KEY=your_key_here npm run analyze-complexity-research
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
- Prioritizes tasks by priority level, dependency count, and task ID
- Displays comprehensive information about the selected task:
  - Basic task details (ID, title, priority, dependencies)
  - Implementation details
  - Subtasks (if they exist)
- Provides contextual suggested actions:
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
9. **Validate dependencies**: Periodically run the validate-dependencies command to check for invalid or circular dependencies.

## Examples

### Starting a new project
```
I've just initialized a new project. I have a PRD at scripts/prd.txt. 
Can you help me parse it and set up the initial tasks?
```

### Working on tasks
```
What's the next task I should work on? Please consider dependencies and priorities.
```

### Implementing a specific task
```
I'd like to implement task 4. Can you help me understand what needs to be done and how to approach it?
```

### Managing subtasks
```
I need to regenerate the subtasks for task 3 with a different approach. Can you help me clear and regenerate them?
```

### Handling changes
```
We've decided to use MongoDB instead of PostgreSQL. Can you update all future tasks to reflect this change?
```

### Completing work
```
I've finished implementing the authentication system described in task 2. All tests are passing. 
Please mark it as complete and tell me what I should work on next.
```

### Analyzing complexity
```
Can you analyze the complexity of our tasks to help me understand which ones need to be broken down further?
```

### Viewing complexity report
```
Can you show me the complexity report in a more readable format?
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

