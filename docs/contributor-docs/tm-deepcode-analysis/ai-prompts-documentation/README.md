# Claude Task Master - AI Prompts Documentation

This directory contains comprehensive documentation of all AI prompts used in the Claude Task Master system.

## Directory Contents

### 1. [AI_PROMPTS_DOCUMENTATION.md](AI_PROMPTS_DOCUMENTATION.md)
**415 lines** - Complete documentation of all AI prompts including:
- Full prompt text for each command
- Template variables and their usage
- Prompt engineering patterns
- Best practices for prompt maintenance

### 2. [AI_PROMPTS_QUICK_REFERENCE.md](AI_PROMPTS_QUICK_REFERENCE.md)
**110 lines** - Quick reference guide featuring:
- Command-to-prompt mappings
- MCP tool mappings
- Prompt categories and features
- Template variable reference

## Prompt Categories

### Generation Prompts
- **parse-prd**: Generate tasks from Product Requirements Documents
- **expand**: Break tasks into subtasks
- **add-task**: Create new tasks with AI assistance

### Analysis Prompts
- **analyze-complexity**: Evaluate task difficulty and provide recommendations

### Update Prompts
- **update**: Modify multiple tasks while preserving structure
- **update-task-by-id**: Update single task properties
- **update-subtask-by-id**: Generate subtask descriptions

## Key Features

### 1. Unified System
MCP tools use the exact same prompts as CLI commands via shared direct functions, ensuring consistency across interfaces.

### 2. Template Variables
Dynamic content insertion using `${variable}` syntax:
- Task properties: `${task.id}`, `${task.title}`, etc.
- Control variables: `${numTasks}`, `${numSubtasks}`
- Content variables: `${prdContent}`, `${prompt}`

### 3. Multi-Mode Support
- **Standard Mode**: Default AI provider
- **Research Mode**: Perplexity AI for enhanced research
- **Fallback Mode**: Automatic provider switching on failure

### 4. Structured Output
All prompts specify exact JSON schemas for consistent parsing and validation.

## Usage

### Finding a Prompt
1. Check the [Quick Reference](AI_PROMPTS_QUICK_REFERENCE.md) for command mappings
2. Look up the full prompt in the [Documentation](AI_PROMPTS_DOCUMENTATION.md)

### Understanding Prompts
Each prompt includes:
- System prompt (role and context)
- User prompt (specific instructions)
- Output schema (expected format)
- Template variables (dynamic content)

### Modifying Prompts
When updating prompts:
1. Locate the prompt in the source file mentioned in documentation
2. Maintain the same structure and output format
3. Test thoroughly with various inputs
4. Update documentation if changes are significant

## Integration with Claude Code

These prompts can be used to create Claude Code slash commands that interact with Task Master. See the [Claude Code Integration Guide](../../claude-code-cosmotechnics/documentation/CLAUDE_CODE_TASK_MASTER_INTEGRATION.md) for examples.

## Related Documentation
- [Task Master README](../../../../README.md)
- [Claude Code Cosmotechnics](../../claude-code-cosmotechnics/)
- [Deep Code Analysis](../README.md)