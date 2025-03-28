# Task Master
### by [@eyaltoledano](https://x.com/eyaltoledano)

A task management system for AI-driven development with Claude, designed to work seamlessly with Cursor AI.

## Requirements

- Node.js 14.0.0 or higher
- Anthropic API key (Claude API)
- Anthropic SDK version 0.39.0 or higher
- OpenAI SDK (for Perplexity API integration, optional)

## Configuration

The script can be configured through environment variables in a `.env` file at the root of the project:

### Required Configuration
- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude

### Optional Configuration
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

# If installed locally
npx task-master-init
```

This will prompt you for project details and set up a new project with the necessary files and structure.

### Important Notes

1. This package uses ES modules. Your package.json should include `"type": "module"`.
2. The Anthropic SDK version should be 0.39.0 or higher.

## Quick Start with Global Commands

After installing the package globally, you can use these CLI commands from any directory:

```bash
# Initialize a new project
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

## Integrating with Cursor AI

Claude Task Master is designed to work seamlessly with [Cursor AI](https://www.cursor.so/), providing a structured workflow for AI-driven development.

### Setup with Cursor

1. After initializing your project, open it in Cursor
2. The `.cursor/rules/dev_workflow.mdc` file is automatically loaded by Cursor, providing the AI with knowledge about the task management system
3. Place your PRD document in the `scripts/` directory (e.g., `scripts/prd.txt`)
4. Open Cursor's AI chat and switch to Agent mode

### Initial Task Generation

In Cursor's AI chat, instruct the agent to generate tasks from your PRD:

```
Please use the task-master parse-prd command to generate tasks from my PRD. The PRD is located at scripts/prd.txt.
```

The agent will execute:
```bash
task-master parse-prd scripts/prd.txt
```

This will:
- Parse your PRD document
- Generate a structured `tasks.json` file with tasks, dependencies, priorities, and test strategies
- The agent will understand this process due to the Cursor rules

### Generate Individual Task Files

Next, ask the agent to generate individual task files:

```
Please generate individual task files from tasks.json
```

The agent will execute:
```bash
task-master generate
```

This creates individual task files in the `tasks/` directory (e.g., `task_001.txt`, `task_002.txt`), making it easier to reference specific tasks.

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

### Generate PRD

The PRD generation feature is designed and implemented by [@ZyraV23](https://x.com/ZyraV23), providing a powerful workflow to create professional product requirement documents from raw ideas.

```bash
# Start the interactive PRD generation workflow
task-master generate-prd

# Start with a specific idea
task-master generate-prd --idea="A collaborative task management app for development teams"

# Customize workflow stages
task-master generate-prd --flow="ideate,generate-prd"

# Generate PRD directly from a concept file
task-master generate-prd-file --concept-file="prd/concept.txt"

# Generate PRD with research-backed content
task-master generate-prd-file --concept-file="prd/concept.txt" --research

# Preview PRD before saving
task-master generate-prd-file --concept-file="prd/concept.txt" --preview

# Customize PRD template and sections
task-master generate-prd-file --concept-file="prd/concept.txt" --template=detailed --sections=overview,features,technical,icp

# Force interactive mode
task-master generate-prd-file --concept-file="prd/concept.txt" --interactive
```

The `generate-prd` command now includes an Ideal Customer Profile (ICP) section that helps define:
- Target industries for your product
- Ideal company size and characteristics
- Key decision makers and influencers
- Specific customer pain points addressed
- Customer buying criteria

This addition helps in creating more focused PRDs that clearly identify who the product is designed for.

### PRD Generation Workflow

The PRD generation feature provides a structured, guided process for creating professional product requirement documents from raw ideas:

1. **Ideation Stage** (`ideate` command):
   - Converts raw product ideas into structured concepts
   - Adds product vision, goals, and target audience
   - Generates problem statements and success criteria
   - Interactive prompts guide you through the process

2. **Expert Insights** (`round-table` command):
   - Simulates a discussion between domain experts
   - Customizable expert roles (Product Manager, Developer, Designer, etc.)
   - Generates insights, recommendations, and potential challenges
   - Helps identify blind spots and edge cases

3. **Concept Refinement** (`refine-concept` command):
   - Improves and deepens the initial concept
   - Incorporates expert insights and recommendations
   - Adds implementation details and technical considerations
   - Provides structured feedback on concept quality

4. **PRD Creation** (`generate-prd-file` command):
   - Transforms refined concepts into comprehensive PRDs
   - Supports multiple output formats (Markdown, Plain Text, HTML)
   - Customizable detail levels (Standard, Detailed, Minimal)
   - Optional sections based on project requirements
   - Research-backed generation for market validation

5. **Task Generation** (existing functionality):
   - Use the PRD with `parse-prd` to create tasks automatically
   - Maintains the complete workflow from idea to implementation

### Step-by-Step PRD Generation Guide

#### Windows PowerShell

PowerShell users may encounter issues with long command lines. Here's a step-by-step guide to work around these limitations:

1. **Create a `.env` file** with your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your-api-key-here
   MODEL=claude-3-7-sonnet-20250219
   MAX_TOKENS=4000
   TEMPERATURE=0.7
   DEBUG=true
   LOG_LEVEL=debug
   ```

2. **Create batch files** for each step of the workflow to avoid PowerShell command length limitations:
   ```powershell
   # Create run-ideate.bat
   @echo off
   node scripts/dev.js ideate --idea="Your product idea here" --output=prd/concept.txt

   # Create run-roundtable.bat
   @echo off
   node scripts/dev.js round-table --concept-file=prd/concept.txt --participants=product_manager,developer,designer --output=prd/discussion.txt

   # Create run-refine-concept.bat
   @echo off
   node scripts/dev.js refine-concept --concept-file=prd/concept.txt --discussion-file=prd/discussion.txt --output=prd/refined-concept.txt

   # Create run-generate-prd.bat
   @echo off
   node scripts/dev.js generate-prd-file --concept-file=prd/refined-concept.txt --output=prd/prd.txt --interactive

   # Create run-parse-prd.bat
   @echo off
   node scripts/dev.js parse-prd --input=prd/prd.txt
   ```

3. **Execute each step** in sequence:
   ```powershell
   .\run-ideate.bat
   .\run-roundtable.bat
   .\run-refine-concept.bat
   .\run-generate-prd.bat
   .\run-parse-prd.bat
   ```

#### Linux/macOS (Bash/Zsh)

Linux and macOS users can run the commands directly in the terminal:

1. **Create a `.env` file** with your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your-api-key-here
   MODEL=claude-3-7-sonnet-20250219
   MAX_TOKENS=4000
   TEMPERATURE=0.7
   DEBUG=true
   LOG_LEVEL=debug
   ```

2. **Execute each step** of the workflow in sequence:
   ```bash
   # Step 1: Ideate
   node scripts/dev.js ideate --idea="Your product idea here" --output=prd/concept.txt

   # Step 2: Round-table
   node scripts/dev.js round-table --concept-file=prd/concept.txt --participants=product_manager,developer,designer --output=prd/discussion.txt

   # Step 3: Refine concept
   node scripts/dev.js refine-concept --concept-file=prd/concept.txt --discussion-file=prd/discussion.txt --output=prd/refined-concept.txt

   # Step 4: Generate PRD
   node scripts/dev.js generate-prd-file --concept-file=prd/refined-concept.txt --output=prd/prd.txt --interactive

   # Step 5: Parse PRD
   node scripts/dev.js parse-prd --input=prd/prd.txt
   ```

3. **Optional**: Create a shell script to automate the entire workflow:
   ```bash
   #!/bin/bash
   # create-prd.sh
   
   # Make the directory if it doesn't exist
   mkdir -p prd
   
   # Step 1: Ideate
   echo "Step 1: Generating product concept..."
   node scripts/dev.js ideate --idea="$1" --output=prd/concept.txt
   
   # Step 2: Round-table
   echo "Step 2: Simulating expert discussion..."
   node scripts/dev.js round-table --concept-file=prd/concept.txt --participants=product_manager,developer,designer --output=prd/discussion.txt
   
   # Step 3: Refine concept
   echo "Step 3: Refining concept with expert feedback..."
   node scripts/dev.js refine-concept --concept-file=prd/concept.txt --discussion-file=prd/discussion.txt --output=prd/refined-concept.txt
   
   # Step 4: Generate PRD
   echo "Step 4: Generating PRD document..."
   node scripts/dev.js generate-prd-file --concept-file=prd/refined-concept.txt --output=prd/prd.txt --interactive
   
   # Step 5: Parse PRD
   echo "Step 5: Parsing PRD into tasks..."
   node scripts/dev.js parse-prd --input=prd/prd.txt
   
   echo "PRD workflow complete! Check the prd directory for outputs and tasks/tasks.json for generated tasks."
   ```

   Make it executable and run it:
   ```bash
   chmod +x create-prd.sh
   ./create-prd.sh "Your product idea here"
   ```

### Troubleshooting the PRD Generation Process

1. **PowerShell Command Length Issues**:
   - If you encounter `System.ArgumentOutOfRangeException` errors in PowerShell, use the batch file approach described above
   - Alternatively, reduce command line length by using shorter file paths
   - Set environment variables separately before running commands

2. **API Connectivity Issues**:
   - Verify your Anthropic API key is correctly set in the `.env` file
   - Check the debug logs by setting `DEBUG=true` in your `.env` file
   - The error `callAnthropicApi is not defined` may indicate an implementation issue - update to the latest version of the package

3. **Interactive Mode in Scripts**:
   - When running in batch files or shell scripts, interactive prompts may not show correctly
   - Use the `--yes` flag where available to accept defaults
   - For detailed customization, run commands individually with the `--interactive` flag

4. **File Permissions**:
   - Ensure the script has write permissions to the output directories
   - Linux/macOS users should check file permissions with `ls -la prd/`

### PRD Customization Options

The PRD generation system offers extensive customization:

- **Output Formats**: Choose from Markdown, Plain Text, or HTML
- **Detail Levels**: Standard, Detailed, or Minimal based on project requirements
- **Section Selection**: Include only relevant sections for your project
- **Templates**: Use custom templates or the built-in options
- **ICP Integration**: Define your ideal customer profiles in detail
- **Research Integration**: Add market research data via Perplexity AI

### Interactive Usage

All PRD commands support interactive modes:

```bash
# Start the full guided workflow
task-master generate-prd

# Start from a specific stage
task-master refine-concept
```

The interactive prompts will guide you through providing all necessary information.

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

1. **Start with a detailed PRD**: The more detailed your PRD, the better the generated tasks will be.

2. **Review generated tasks**: After parsing the PRD, review the tasks to ensure they make sense and have appropriate dependencies.

3. **Analyze task complexity**: Use the complexity analysis feature to identify which tasks should be broken down further.

4. **Follow the dependency chain**: Always respect task dependencies - the Cursor agent will help with this.

5. **Update as you go**: If your implementation diverges from the plan, use the update command to keep future tasks aligned with your current approach.

6. **Break down complex tasks**: Use the expand command to break down complex tasks into manageable subtasks.

7. **Regenerate task files**: After any updates to tasks.json, regenerate the task files to keep them in sync.

8. **Communicate context to the agent**: When asking the Cursor agent to help with a task, provide context about what you're trying to achieve.

9. **Validate dependencies**: Periodically run the validate-dependencies command to check for invalid or circular dependencies.

## Example Cursor AI Interactions

### Starting a new project
```
I've just initialized a new project with Claude Task Master. I have a PRD at scripts/prd.txt. 
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

## License

This project contains both open source and proprietary components:

1. **Task Master Core**: Copyright of Eyal Toledano, available under a modified MIT License with restrictions.

2. **PRD Generator Core Library**: Copyright of Zyra-V23, available under a modified MIT License with commercial use restrictions.

3. **PRD Generator SaaS**: Copyright of Zyra-V23, proprietary software available as a hosted service (coming soon).

### Important Copyright Notice

The PRD Generator functionality (including ideate, round-table, refine-concept, and generate-prd-file commands) is copyright of Zyra and is protected by copyright law. This software is provided under a modified MIT license with significant commercial use restrictions.

### Commercial Use Restrictions

**ANY commercial use of the PRD Generator requires explicit written permission** from Zyra, including:
- Incorporating the code into commercial products
- Using the functionality in commercial services
- Selling or licensing access to the software
- Using it to generate content that is monetized

### Exclusive SaaS Rights

The right to offer the PRD Generator as a Software as a Service (SaaS) is exclusively reserved for Zyra. A commercial SaaS offering is currently in development and will be available soon.

### Authorized Usage

You ARE permitted to:
- Use the software for personal, non-commercial/opensource projects
- Modify the code for personal, non-commercial use
- Contribute improvements back to the project
- Fork the repository for non-commercial purposes

### Legal Protection

This software is protected under copyright law, and violations of the license terms may result in legal action, including statutory damages for copyright infringement.

For full details, see the [LICENSE](LICENSE) file.

For licensing inquiries or commercial use permissions, please contact:
- For PRD Generator functionality: Zyra-V23
- For Task Master core functionality: Eyal Toledano