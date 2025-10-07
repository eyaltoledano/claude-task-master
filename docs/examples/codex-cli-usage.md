# Codex CLI Provider Usage Examples

This guide provides practical examples of using Task Master with the Codex CLI provider.

## Prerequisites

Before using these examples, ensure you have:

```bash
# 1. Codex CLI installed
npm install -g @openai/codex

# 2. Authenticated with ChatGPT
codex login

# 3. Codex CLI configured as your provider
task-master models --set-main gpt-5-codex --codex-cli
```

## Example 1: Basic Task Creation

Use Codex CLI to create tasks from a simple description:

```bash
# Add a task with AI-powered enhancement
task-master add-task --prompt="Implement user authentication with JWT" --research
```

**What happens**:
1. Task Master sends your prompt to GPT-5-Codex via the CLI
2. The AI analyzes your request and generates a detailed task
3. The task is added to your `.taskmaster/tasks/tasks.json`
4. OAuth credentials are automatically used (no API key needed)

## Example 2: Parsing a Product Requirements Document

Create a comprehensive task list from a PRD:

```bash
# Create your PRD
cat > my-feature.txt <<EOF
# User Profile Feature

## Requirements
1. Users can view their profile
2. Users can edit their information
3. Profile pictures can be uploaded
4. Email verification required

## Technical Constraints
- Use React for frontend
- Node.js/Express backend
- PostgreSQL database
EOF

# Parse with Codex CLI
task-master parse-prd my-feature.txt --num-tasks 12
```

**What happens**:
1. GPT-5-Codex reads and analyzes your PRD
2. Generates structured tasks with dependencies
3. Creates subtasks for complex items
4. Saves everything to `.taskmaster/tasks/`

## Example 3: Expanding Tasks with Research

Break down a complex task into detailed subtasks:

```bash
# First, show your current tasks
task-master list

# Expand a specific task (e.g., task 1.2)
task-master expand --id=1.2 --research --force
```

**What happens**:
1. Codex CLI uses GPT-5 for research-level analysis
2. Breaks down the task into logical subtasks
3. Adds implementation details and test strategies
4. Updates the task with dependency information

## Example 4: Analyzing Project Complexity

Get AI-powered insights into your project's task complexity:

```bash
# Analyze all tasks
task-master analyze-complexity --research

# View the complexity report
task-master complexity-report
```

**What happens**:
1. GPT-5 analyzes each task's scope and requirements
2. Assigns complexity scores and estimates subtask counts
3. Generates a detailed report
4. Saves to `.taskmaster/reports/task-complexity-report.json`

## Example 5: Using Custom Codex CLI Settings

Configure Codex CLI behavior for different commands:

```json
// In .taskmaster/config.json
{
  "models": {
    "main": {
      "provider": "codex-cli",
      "modelId": "gpt-5-codex",
      "maxTokens": 128000,
      "temperature": 0.2
    }
  },
  "codexCli": {
    "allowNpx": true,
    "approvalMode": "on-failure",
    "sandboxMode": "workspace-write",
    "commandSpecific": {
      "parse-prd": {
        "verbose": true,
        "approvalMode": "never"
      },
      "expand": {
        "sandboxMode": "read-only",
        "verbose": true
      }
    }
  }
}
```

```bash
# Now parse-prd runs with verbose output and no approvals
task-master parse-prd requirements.txt

# Expand runs with read-only mode
task-master expand --id=2.1
```

## Example 6: Workflow - Building a Feature End-to-End

Complete workflow from PRD to implementation tracking:

```bash
# Step 1: Initialize project
task-master init

# Step 2: Set up Codex CLI
task-master models --set-main gpt-5-codex --codex-cli
task-master models --set-fallback gpt-5 --codex-cli

# Step 3: Create PRD
cat > feature-prd.txt <<EOF
# Authentication System

Implement a complete authentication system with:
- User registration
- Email verification
- Password reset
- Two-factor authentication
- Session management
EOF

# Step 4: Parse PRD into tasks
task-master parse-prd feature-prd.txt --num-tasks 8

# Step 5: Analyze complexity
task-master analyze-complexity --research

# Step 6: Expand complex tasks
task-master expand --all --research

# Step 7: Start working
task-master next
# Shows: Task 1.1: User registration database schema

# Step 8: Mark completed as you work
task-master set-status --id=1.1 --status=done

# Step 9: Continue to next task
task-master next
```

## Example 7: Multi-Role Configuration

Use Codex CLI for main tasks, Perplexity for research:

```json
// In .taskmaster/config.json
{
  "models": {
    "main": {
      "provider": "codex-cli",
      "modelId": "gpt-5-codex",
      "maxTokens": 128000,
      "temperature": 0.2
    },
    "research": {
      "provider": "perplexity",
      "modelId": "sonar-pro",
      "maxTokens": 8700,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "codex-cli",
      "modelId": "gpt-5",
      "maxTokens": 128000,
      "temperature": 0.2
    }
  }
}
```

```bash
# Main task operations use GPT-5-Codex
task-master add-task --prompt="Build REST API endpoint"

# Research operations use Perplexity
task-master analyze-complexity --research

# Fallback to GPT-5 if needed
task-master expand --id=3.2 --force
```

## Example 8: Troubleshooting Common Issues

### Issue: Codex CLI not found

```bash
# Check if Codex is installed
codex --version

# If not found, install globally
npm install -g @openai/codex

# Or enable npx fallback in config
cat >> .taskmaster/config.json <<EOF
{
  "codexCli": {
    "allowNpx": true
  }
}
EOF
```

### Issue: Not authenticated

```bash
# Check auth status
codex
# Use /about command to see auth info

# Re-authenticate if needed
codex login
```

### Issue: Want more verbose output

```bash
# Enable verbose mode in config
cat >> .taskmaster/config.json <<EOF
{
  "codexCli": {
    "verbose": true
  }
}
EOF

# Or for specific commands
task-master parse-prd my-prd.txt
# (verbose output shows detailed Codex CLI interactions)
```

## Example 9: CI/CD Integration

Use Codex CLI in automated workflows:

```yaml
# .github/workflows/task-analysis.yml
name: Analyze Task Complexity

on:
  push:
    paths:
      - '.taskmaster/**'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Task Master
        run: npm install -g task-master-ai

      - name: Configure Codex CLI
        run: |
          npm install -g @openai/codex
          echo "${{ secrets.OPENAI_CODEX_API_KEY }}" > ~/.codex-auth
        env:
          OPENAI_CODEX_API_KEY: ${{ secrets.OPENAI_CODEX_API_KEY }}

      - name: Configure Task Master
        run: |
          cat > .taskmaster/config.json <<EOF
          {
            "models": {
              "main": {
                "provider": "codex-cli",
                "modelId": "gpt-5"
              }
            },
            "codexCli": {
              "allowNpx": true,
              "skipGitRepoCheck": true,
              "approvalMode": "never",
              "fullAuto": true
            }
          }
          EOF

      - name: Analyze Complexity
        run: task-master analyze-complexity --research

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: complexity-report
          path: .taskmaster/reports/task-complexity-report.json
```

## Best Practices

### 1. Use OAuth for Development

```bash
# For local development, use OAuth (no API key needed)
codex login
task-master models --set-main gpt-5-codex --codex-cli
```

### 2. Configure Approval Modes Appropriately

```json
{
  "codexCli": {
    "approvalMode": "on-failure",  // Safe default
    "sandboxMode": "workspace-write"  // Restricts to project directory
  }
}
```

### 3. Use Command-Specific Settings

```json
{
  "codexCli": {
    "commandSpecific": {
      "parse-prd": {
        "approvalMode": "never",  // PRD parsing is safe
        "verbose": true
      },
      "expand": {
        "approvalMode": "on-request",  // More cautious for task expansion
        "verbose": false
      }
    }
  }
}
```

### 4. Leverage Codebase Analysis

```json
{
  "global": {
    "enableCodebaseAnalysis": true  // Let Codex analyze your code
  }
}
```

### 5. Handle Errors Gracefully

```bash
# Always configure a fallback model
task-master models --set-fallback gpt-5 --codex-cli

# Or use a different provider as fallback
task-master models --set-fallback claude-3-5-sonnet
```

## Next Steps

- Read the [Codex CLI Provider Documentation](../providers/codex-cli.md)
- Explore [Configuration Options](../configuration.md#codex-cli-provider)
- Check out [Command Reference](../command-reference.md)
- Learn about [Task Structure](../task-structure.md)

## Common Patterns

### Pattern: Daily Development Workflow

```bash
# Morning: Review tasks
task-master list

# Get next task
task-master next

# Work on task...

# Update task with notes
task-master update-subtask --id=2.3 --prompt="Implemented authentication middleware"

# Mark complete
task-master set-status --id=2.3 --status=done

# Repeat
```

### Pattern: Feature Planning

```bash
# Write feature spec
vim new-feature.txt

# Generate tasks
task-master parse-prd new-feature.txt --num-tasks 10

# Analyze and expand
task-master analyze-complexity --research
task-master expand --all --research --force

# Review and adjust
task-master list
```

### Pattern: Sprint Planning

```bash
# Parse sprint requirements
task-master parse-prd sprint-requirements.txt

# Analyze complexity
task-master analyze-complexity --research

# View report
task-master complexity-report

# Adjust task estimates based on complexity scores
```

---

For more examples and advanced usage, see the [full documentation](https://docs.task-master.dev).
