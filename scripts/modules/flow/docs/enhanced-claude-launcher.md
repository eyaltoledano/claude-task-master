# Enhanced Claude Code Launcher with Hooks Integration

## Overview

The Enhanced Claude Code Launcher provides an improved workflow for starting Claude Code sessions with comprehensive validation, research integration, and automated post-session actions.

## Workflow Steps

### 1. Persona Selection
- **Auto-Detection**: Analyzes task content to suggest appropriate personas
- **Manual Selection**: Choose from available persona types
- **Quick Selection**: Use number keys (1-9) for rapid selection

### 2. Tool Configuration
- **Shell Commands**: Enable/disable shell command access
- **File Operations**: Control file creation, editing, and deletion
- **Web Search**: Allow/restrict web search capabilities
- **Max Turns**: Adjust session length (5-30 turns)

### 3. Custom Instructions (Optional)
- **Custom Prompt**: Add specific instructions for the session
- **Skip Option**: Use default implementation prompt

### 4. Research Analysis
- **Automatic Detection**: Hooks analyze if research would benefit the task
- **Research Options**: 
  - Run research if recommended
  - Skip if not needed or already available
  - View existing research if present
- **Integration**: Research results are automatically included in CLAUDE.md

### 5. Final Review
- **Configuration Summary**: Review all selected options
- **Worktree Information**: See target worktree and branch details
- **Research Status**: Confirm research inclusion
- **Launch Confirmation**: Final approval before starting

### 6. Processing
- **Worktree Creation**: Automatic worktree setup if needed
- **Research Execution**: Run research if selected
- **CLAUDE.md Preparation**: Generate context file with task details
- **Session Launch**: Start Claude Code with configured options

### 7. Completion
- **Session Summary**: View operation details
- **Background Monitoring**: Track progress in Background Operations
- **Auto-PR Creation**: Optional automatic pull request creation

## Hook Integration

### Available Hooks

1. **Pre-Launch Validation**
   - Validates git status and dependencies
   - Checks for worktree conflicts
   - Ensures configuration is valid

2. **Research Integration**
   - Analyzes task complexity and keywords
   - Determines research needs and confidence
   - Manages research workflow

3. **Session Completion**
   - Collects session statistics
   - Updates task status automatically
   - Handles PR creation
   - Provides completion recommendations

### Hook Configuration

Hooks are configured in `scripts/modules/flow/hooks/config/default-config.json`:

```json
{
  "hooks": {
    "research-integration": { "enabled": true },
    "pre-launch-validation": { "enabled": true },
    "session-completion": { "enabled": true }
  },
  "executor": {
    "timeout": 30000,
    "maxConcurrent": 3
  }
}
```

### Hook Events

The system supports these events:
- `pre-launch` - Before session starts
- `post-worktree` - After worktree creation
- `pre-research` / `post-research` - Research lifecycle
- `pre-claude-md` / `post-claude-md` - CLAUDE.md preparation
- `session-started` / `session-completed` / `session-failed` - Session lifecycle
- `pre-pr` / `pr-created` - Pull request lifecycle

## Key Features

### Error Resilience
- Hooks failures don't prevent Flow TUI operation
- Graceful fallbacks for missing hook functionality
- Comprehensive error logging and recovery

### Performance
- Concurrent hook execution where possible
- Timeout protection for long-running hooks
- Efficient context sharing between hooks

### Extensibility
- Easy to add new built-in hooks
- Future support for user-defined hooks
- Event-driven architecture for loose coupling

### Security
- Hook validation prevents dangerous operations
- Sandboxed execution environment
- Input sanitization and validation

## Usage Tips

1. **First Time Setup**: The system auto-initializes hooks on first use
2. **Research Benefits**: Let hooks analyze research needs - they're often accurate
3. **Validation Warnings**: Pay attention to pre-launch validation warnings
4. **Background Monitoring**: Use Background Operations screen to track progress
5. **Hook Status**: Check hook system status in the enhanced launcher

## Troubleshooting

### Hook System Issues
- Check that hooks are properly initialized
- Verify configuration file is valid JSON
- Review hook execution logs for errors

### Research Problems
- Ensure backend research service is available
- Check API keys for research providers
- Verify task content has analyzable keywords

### Session Launch Failures
- Review pre-launch validation results
- Check git repository status
- Ensure worktree paths are accessible

## Development

### Adding New Hooks

1. Create hook class in `scripts/modules/flow/hooks/built-in/`
2. Implement required event methods (`onPreLaunch`, etc.)
3. Add hook to configuration file
4. Update hook manager to load the new hook

### Hook Development Guidelines

- Always return structured results
- Handle errors gracefully
- Include timeout protection
- Provide meaningful validation messages
- Use consistent logging patterns

## Integration with Task Master

The enhanced launcher integrates seamlessly with:
- **Task Management**: Updates task status and details
- **Worktree System**: Creates and manages git worktrees
- **Research Tools**: Leverages Task Master research capabilities
- **Background Operations**: Tracks long-running processes
- **Pull Request Workflow**: Automates PR creation and management 