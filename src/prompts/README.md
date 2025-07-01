# Task Master Prompt Management System

This directory contains the centralized prompt templates for all AI-powered features in Task Master.

## Overview

The prompt management system provides:
- **Centralized Storage**: All prompts in one location (`/src/prompts`)
- **Version Control**: Track changes to prompts over time
- **Variant Support**: Different prompts for different contexts (research mode, complexity levels, etc.)
- **Template Variables**: Dynamic prompt generation with variable substitution

## Directory Structure

```
src/prompts/
├── README.md                # This file
├── parse-prd.json          # PRD parsing prompts
├── expand-task.json        # Task expansion prompts
├── add-task.json           # Task creation prompts
├── update-tasks.json       # Bulk task update prompts
├── update-task.json        # Single task update prompts
├── update-subtask.json     # Subtask update prompts
├── analyze-complexity.json # Complexity analysis prompts
└── research.json           # Research query prompts
```

## Prompt Template Reference

### 1. parse-prd.json
**Purpose**: Parse a Product Requirements Document into structured tasks  
**Variants**: `default`, `research` (when research mode is enabled)

**Required Parameters**:
- `numTasks` (number): Target number of tasks to generate
- `nextId` (number): Starting ID for tasks
- `prdContent` (string): Content of the PRD file
- `prdPath` (string): Path to the PRD file
- `defaultTaskPriority` (string): Default priority for generated tasks

**Optional Parameters**:
- `research` (boolean): Enable research mode for latest best practices (default: false)

**Usage**: Used by `task-master parse-prd` command to convert PRD documents into actionable task lists.

### 2. add-task.json
**Purpose**: Generate a new task based on user description  
**Variants**: `default`, `research` (when research mode is enabled)

**Required Parameters**:
- `prompt` (string): User's task description
- `newTaskId` (number): ID for the new task

**Optional Parameters**:
- `existingTasks` (array): List of existing tasks for context
- `gatheredContext` (string): Context gathered from codebase analysis
- `contextFromArgs` (string): Additional context from manual args
- `priority` (string): Task priority (high/medium/low, default: medium)
- `dependencies` (array): Task dependency IDs
- `useResearch` (boolean): Use research mode (default: false)

**Usage**: Used by `task-master add-task` command to create new tasks with AI assistance.

### 3. expand-task.json
**Purpose**: Break down a task into detailed subtasks  
**Variants**: `default`, `research` (when research mode is enabled)

**Required Parameters**:
- `subtaskCount` (number): Number of subtasks to generate
- `task` (object): The task to expand
- `nextSubtaskId` (number): Starting ID for new subtasks

**Optional Parameters**:
- `additionalContext` (string): Additional context for expansion
- `useResearch` (boolean): Use research mode (default: false)

**Usage**: Used by `task-master expand` command to break complex tasks into manageable subtasks.

### 4. update-task.json
**Purpose**: Update a single task with new information, supporting full updates and append mode  
**Variants**: `default`, `append` (when appendMode is true), `research` (when research mode is enabled)

**Required Parameters**:
- `task` (object): The task to update
- `taskJson` (string): JSON string representation of the task
- `updatePrompt` (string): Description of changes to apply

**Optional Parameters**:
- `appendMode` (boolean): Whether to append to details or do full update (default: false)
- `useResearch` (boolean): Use research mode (default: false)
- `currentDetails` (string): Current task details for context (default: "(No existing details)")
- `gatheredContext` (string): Additional project context

**Usage**: Used by `task-master update-task` command to modify existing tasks.

### 5. update-tasks.json
**Purpose**: Update multiple tasks based on new context or changes  
**Variants**: `default`, `research` (when research mode is enabled)

**Required Parameters**:
- `tasks` (array): Array of tasks to update
- `updatePrompt` (string): Description of changes to apply

**Optional Parameters**:
- `useResearch` (boolean): Use research mode (default: false)
- `projectContext` (string): Additional project context

**Usage**: Used by `task-master update` command to bulk update multiple tasks.

### 6. update-subtask.json
**Purpose**: Append information to a subtask by generating only new content  
**Variants**: `default`, `research` (when research mode is enabled)

**Required Parameters**:
- `parentTask` (object): The parent task context
- `currentDetails` (string): Current subtask details (default: "(No existing details)")
- `updatePrompt` (string): User request for what to add

**Optional Parameters**:
- `prevSubtask` (object): The previous subtask if any
- `nextSubtask` (object): The next subtask if any
- `useResearch` (boolean): Use research mode (default: false)
- `gatheredContext` (string): Additional project context

**Usage**: Used by `task-master update-subtask` command to log progress and findings on subtasks.

### 7. analyze-complexity.json
**Purpose**: Analyze task complexity and generate expansion recommendations  
**Variants**: `default`, `research` (when research mode is enabled), `batch` (when analyzing >10 tasks)

**Required Parameters**:
- `tasks` (array): Array of tasks to analyze

**Optional Parameters**:
- `gatheredContext` (string): Additional project context
- `threshold` (number): Complexity threshold for expansion recommendation (1-10, default: 5)
- `useResearch` (boolean): Use research mode for deeper analysis (default: false)

**Usage**: Used by `task-master analyze-complexity` command to determine which tasks need breakdown.

### 8. research.json
**Purpose**: Perform AI-powered research with project context  
**Variants**: `default`, `low` (concise responses), `medium` (balanced), `high` (detailed)

**Required Parameters**:
- `query` (string): Research query

**Optional Parameters**:
- `gatheredContext` (string): Gathered project context
- `detailLevel` (string): Level of detail (low/medium/high, default: medium)
- `projectInfo` (object): Project information with properties:
  - `root` (string): Project root path
  - `taskCount` (number): Number of related tasks
  - `fileCount` (number): Number of related files

**Usage**: Used by `task-master research` command to get contextual information and guidance.

## Template Structure

Each prompt template is a JSON file with the following structure:

```json
{
  "id": "unique-identifier",
  "version": "1.0.0",
  "description": "What this prompt does",
  "metadata": {
    "author": "system",
    "created": "2024-01-01T00:00:00Z",
    "updated": "2024-01-01T00:00:00Z",
    "tags": ["category", "feature"]
  },
  "parameters": {
    "paramName": {
      "type": "string|number|boolean|array|object",
      "required": true|false,
      "default": "default value",
      "description": "Parameter description"
    }
  },
  "prompts": {
    "default": {
      "system": "System prompt template",
      "user": "User prompt template"
    },
    "variant-name": {
      "condition": "JavaScript expression",
      "system": "Variant system prompt",
      "user": "Variant user prompt"
    }
  }
}
```

## Template Features

### Variable Substitution
Use `{{variableName}}` to inject dynamic values:
```
"user": "Analyze these {{tasks.length}} tasks with threshold {{threshold}}"
```

### Conditionals
Use `{{#if variable}}...{{/if}}` for conditional content:
```
"user": "{{#if useResearch}}Research and {{/if}}create a task"
```

### Loops
Use `{{#each array}}...{{/each}}` to iterate over arrays:
```
"user": "Tasks:\n{{#each tasks}}- {{id}}: {{title}}\n{{/each}}"
```

### JSON Serialization
Use `{{{json variable}}}` (triple braces) to serialize objects/arrays to JSON:
```
"user": "Analyze these tasks: {{{json tasks}}}"
```

### Nested Properties
Access nested properties with dot notation:
```
"user": "Project: {{context.projectName}}"
```

## Prompt Variants

Variants allow different prompts based on conditions:

```json
{
  "prompts": {
    "default": {
      "system": "Default system prompt",
      "user": "Default user prompt"
    },
    "research": {
      "condition": "useResearch === true",
      "system": "Research-focused system prompt",
      "user": "Research-focused user prompt"
    },
    "high-complexity": {
      "condition": "complexityScore >= 8",
      "system": "Complex task handling prompt",
      "user": "Detailed breakdown request"
    }
  }
}
```

## PromptManager Module

The PromptManager is implemented in `scripts/modules/prompt-manager.js` and provides:
- **Template loading and caching**: Templates are loaded once and cached for performance
- **Variable substitution**: Handlebars-like syntax for dynamic content
- **Variant selection**: Automatic selection based on conditions
- **Singleton pattern**: One instance per project root for efficiency

## Usage in Code

### Basic Usage
```javascript
import { getPromptManager } from '../prompt-manager.js';

const promptManager = getPromptManager();
const { systemPrompt, userPrompt, metadata } = await promptManager.loadPrompt('add-task', {
  // Parameters matching the template's parameter definitions
  prompt: 'Create a user authentication system',
  newTaskId: 5,
  priority: 'high',
  useResearch: false
});

// Use with AI service
const result = await generateObjectService({
  systemPrompt,
  prompt: userPrompt,
  // ... other AI parameters
});
```

### With Variants
```javascript
// Research variant will be selected automatically
const { systemPrompt, userPrompt } = await promptManager.loadPrompt('expand-task', {
  useResearch: true,  // Triggers research variant
  task: taskObject,
  subtaskCount: 5
});
```

## Adding New Prompts

1. Create a new JSON file following the template structure
2. Define parameters with types and descriptions
3. Create default and variant prompts
4. Use template variables for dynamic content
5. Test the prompt with the PromptManager

## Best Practices

1. **Version Management**: Increment version when making significant changes
2. **Clear Descriptions**: Document what each prompt does and when to use it
3. **Parameter Validation**: Define parameter types and requirements
4. **Variant Conditions**: Use simple, testable conditions for variants
5. **Template Variables**: Use meaningful variable names
6. **Consistent Structure**: Follow the established JSON schema





## Testing Prompts

### Integration Testing
When modifying prompts, ensure to test:
- Variable substitution works with actual data structures
- Variant selection triggers correctly based on conditions
- AI responses remain consistent with expected behavior
- All parameters are properly validated

### Quick Testing
You can test prompt loading directly:
```javascript
// Test prompt loading and variable substitution
const promptManager = getPromptManager();
const result = await promptManager.loadPrompt('research', {
  query: 'What are the latest React best practices?',
  detailLevel: 'medium',
  gatheredContext: 'React project with TypeScript'
});
console.log(result.systemPrompt);
console.log(result.userPrompt);
```
