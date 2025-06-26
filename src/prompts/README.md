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

const promptManager = getPromptManager(projectRoot);
const { systemPrompt, userPrompt, metadata } = await promptManager.loadPrompt('task-id', {
  // Parameters matching the template's parameter definitions
  param1: 'value1',
  param2: true,
  param3: { nested: 'object' }
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
const promptManager = getPromptManager(projectRoot);
const result = await promptManager.loadPrompt('task-id', {
  // Test parameters
});
console.log(result.systemPrompt);
console.log(result.userPrompt);
```

## Future Enhancements

Planned features for the prompt management system:
- A/B testing framework for prompt optimization
- Prompt composition and inheritance
- Hot reloading for development
- User-defined custom prompts 