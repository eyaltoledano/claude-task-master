# Task Master Prompt Management System

This directory contains the centralized prompt templates for all AI-powered features in Task Master.

## Overview

The prompt management system provides:
- **Centralized Storage**: All prompts in one location (`/src/prompts`)
- **JSON Schema Validation**: Comprehensive validation using AJV with detailed error reporting
- **Version Control**: Track changes to prompts over time
- **Variant Support**: Different prompts for different contexts (research mode, complexity levels, etc.)
- **Template Variables**: Dynamic prompt generation with variable substitution
- **IDE Integration**: VS Code IntelliSense and validation support

## Directory Structure

```
src/prompts/
├── README.md                # This file
├── schemas/                 # JSON schemas for validation
│   ├── README.md           # Schema documentation
│   ├── prompt-template.schema.json  # Main template schema
│   ├── parameter.schema.json        # Parameter validation schema
│   └── variant.schema.json          # Prompt variant schema
├── parse-prd.json          # PRD parsing prompts
├── expand-task.json        # Task expansion prompts
├── add-task.json           # Task creation prompts
├── update-tasks.json       # Bulk task update prompts
├── update-task.json        # Single task update prompts
├── update-subtask.json     # Subtask update prompts
├── analyze-complexity.json # Complexity analysis prompts
└── research.json           # Research query prompts
```

## Schema Validation

All prompt templates are validated against JSON schemas located in `/src/prompts/schemas/`. The validation system:

- **Structural Validation**: Ensures required fields and proper nesting
- **Parameter Type Checking**: Validates parameter types, patterns, and ranges
- **Template Syntax**: Validates Handlebars syntax and variable references
- **Semantic Versioning**: Enforces proper version format
- **Cross-Reference Validation**: Ensures parameters match template variables

### Validation Features
- **Required Fields**: `id`, `version`, `description`, `prompts.default`
- **Type Safety**: String, number, boolean, array, object validation
- **Pattern Matching**: Regex validation for string parameters
- **Range Validation**: Min/max values for numeric parameters
- **Enum Constraints**: Restricted value sets for categorical parameters

## Development Workflow

### Setting Up Development Environment
1. **VS Code Integration**: Schemas are automatically configured for IntelliSense
2. **Dependencies**: `ajv` and `ajv-formats` are required for validation
3. **File Watching**: Changes to templates trigger automatic validation

### Creating New Prompts
1. Create a new `.json` file in `/src/prompts/`
2. Follow the schema structure (see Template Structure section)
3. Define parameters with proper types and validation
4. Create system and user prompts with template variables
5. Test with the PromptManager before committing

### Modifying Existing Prompts
1. Update the `version` field following semantic versioning
2. Maintain backward compatibility when possible
3. Test with existing code that uses the prompt
4. Update documentation if parameters change

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
**Purpose**: Break down a task into detailed subtasks with three sophisticated strategies  
**Variants**: `complexity-report` (when expansionPrompt exists), `research` (when research mode is enabled), `default` (standard case)

**Required Parameters**:
- `subtaskCount` (number): Number of subtasks to generate
- `task` (object): The task to expand
- `nextSubtaskId` (number): Starting ID for new subtasks

**Optional Parameters**:
- `additionalContext` (string): Additional context for expansion (default: "")
- `complexityReasoningContext` (string): Complexity analysis reasoning context (default: "")
- `gatheredContext` (string): Gathered project context (default: "")
- `useResearch` (boolean): Use research mode (default: false)
- `expansionPrompt` (string): Expansion prompt from complexity report

**Variant Selection Strategy**:
1. **complexity-report**: Used when `expansionPrompt` exists (highest priority)
2. **research**: Used when `useResearch === true && !expansionPrompt`
3. **default**: Standard fallback strategy

**Usage**: Used by `task-master expand` command to break complex tasks into manageable subtasks using the most appropriate strategy based on available context and complexity analysis.

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
    "tags": ["category", "feature"],
    "category": "task"
  },
  "parameters": {
    "paramName": {
      "type": "string|number|boolean|array|object",
      "required": true|false,
      "default": "default value",
      "description": "Parameter description",
      "enum": ["option1", "option2"],
      "pattern": "^[a-z]+$",
      "minimum": 1,
      "maximum": 100
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
      "user": "Variant user prompt",
      "metadata": {
        "description": "When to use this variant"
      }
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

### Helper Functions

#### Equality Helper
Use `{{#if (eq variable "value")}}...{{/if}}` for string comparisons:
```
"user": "{{#if (eq detailLevel \"low\")}}Provide a brief summary{{/if}}"
"user": "{{#if (eq priority \"high\")}}URGENT: {{/if}}{{taskTitle}}"
```

The `eq` helper enables clean conditional logic based on parameter values:
- Compare strings: `(eq detailLevel "medium")`
- Compare with enum values: `(eq status "pending")`
- Multiple conditions: `{{#if (eq level "1")}}First{{/if}}{{#if (eq level "2")}}Second{{/if}}`

#### Negation Helper
Use `{{#if (not variable)}}...{{/if}}` for negation conditions:
```
"user": "{{#if (not useResearch)}}Use basic analysis{{/if}}"
"user": "{{#if (not hasSubtasks)}}This task has no subtasks{{/if}}"
```

The `not` helper enables clean negative conditional logic:
- Negate boolean values: `(not useResearch)`
- Negate truthy/falsy values: `(not emptyArray)`
- Cleaner than separate boolean parameters: No need for `notUseResearch` flags

#### Numeric Comparison Helpers
Use `{{#if (gt variable number)}}...{{/if}}` for greater than comparisons:
```
"user": "generate {{#if (gt numTasks 0)}}approximately {{numTasks}}{{else}}an appropriate number of{{/if}} top-level development tasks"
"user": "{{#if (gt complexity 5)}}This is a complex task{{/if}}"
"system": "create {{#if (gt subtaskCount 0)}}exactly {{subtaskCount}}{{else}}an appropriate number of{{/if}} subtasks"
```

Use `{{#if (gte variable number)}}...{{/if}}` for greater than or equal comparisons:
```
"user": "{{#if (gte priority 8)}}HIGH PRIORITY{{/if}}"
"user": "{{#if (gte threshold 1)}}Analysis enabled{{/if}}"
"system": "{{#if (gte complexityScore 8)}}Use detailed breakdown approach{{/if}}"
```

The numeric comparison helpers enable sophisticated conditional logic:
- **Dynamic counting**: `{{#if (gt numTasks 0)}}exactly {{numTasks}}{{else}}an appropriate number of{{/if}}`
- **Threshold-based behavior**: `(gte complexityScore 8)` for high-complexity handling
- **Zero checks**: `(gt subtaskCount 0)` for conditional content generation
- **Decimal support**: `(gt score 7.5)` for fractional comparisons
- **Enhanced prompt sophistication**: Enables parse-prd and expand-task logic matching GitHub specifications

### Loops
Use `{{#each array}}...{{/each}}` to iterate over arrays:
```
"user": "Tasks:\n{{#each tasks}}- {{id}}: {{title}}\n{{/each}}"
```

### Special Loop Variables
Inside `{{#each}}` blocks, you have access to:
- `{{@index}}`: Current array index (0-based)
- `{{@first}}`: Boolean, true for first item
- `{{@last}}`: Boolean, true for last item

```
"user": "{{#each tasks}}{{@index}}. {{title}}{{#unless @last}}\n{{/unless}}{{/each}}"
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

### Condition Evaluation
Conditions are JavaScript expressions evaluated with parameter values as context:
- Simple comparisons: `useResearch === true`
- Numeric comparisons: `threshold >= 5`
- String matching: `priority === 'high'`
- Complex logic: `useResearch && threshold > 7`

## PromptManager Module

The PromptManager is implemented in `scripts/modules/prompt-manager.js` and provides:
- **Template loading and caching**: Templates are loaded once and cached for performance
- **Schema validation**: Comprehensive validation using AJV with detailed error reporting
- **Variable substitution**: Handlebars-like syntax for dynamic content
- **Variant selection**: Automatic selection based on conditions
- **Error handling**: Graceful fallbacks and detailed error messages
- **Singleton pattern**: One instance per project root for efficiency

### Validation Behavior
- **Schema Available**: Full validation with detailed error messages
- **Schema Missing**: Falls back to basic structural validation
- **Invalid Templates**: Throws descriptive errors with field-level details
- **Parameter Validation**: Type checking, pattern matching, range validation

## Usage in Code

### Basic Usage
```javascript
import { getPromptManager } from '../prompt-manager.js';

const promptManager = getPromptManager();
const { systemPrompt, userPrompt, metadata } = promptManager.loadPrompt('add-task', {
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
const { systemPrompt, userPrompt } = promptManager.loadPrompt('expand-task', {
  useResearch: true,  // Triggers research variant
  task: taskObject,
  subtaskCount: 5
});
```

### Error Handling
```javascript
try {
  const result = promptManager.loadPrompt('invalid-template', {});
} catch (error) {
  if (error.message.includes('Schema validation failed')) {
    console.error('Template validation error:', error.message);
  } else if (error.message.includes('not found')) {
    console.error('Template not found:', error.message);
  }
}
```

## Adding New Prompts

1. **Create the JSON file** following the template structure
2. **Define parameters** with proper types, validation, and descriptions
3. **Create prompts** with clear system and user templates
4. **Use template variables** for dynamic content
5. **Add variants** if needed for different contexts
6. **Test thoroughly** with the PromptManager
7. **Update this documentation** with the new prompt details

### Example New Prompt
```json
{
  "id": "new-feature",
  "version": "1.0.0",
  "description": "Generate code for a new feature",
  "parameters": {
    "featureName": {
      "type": "string",
      "required": true,
      "pattern": "^[a-zA-Z][a-zA-Z0-9-]*$",
      "description": "Name of the feature to implement"
    },
    "complexity": {
      "type": "string",
      "required": false,
      "enum": ["simple", "medium", "complex"],
      "default": "medium",
      "description": "Feature complexity level"
    }
  },
  "prompts": {
    "default": {
      "system": "You are a senior software engineer.",
      "user": "Create a {{complexity}} {{featureName}} feature."
    }
  }
}
```

## Best Practices

### Template Design
1. **Clear IDs**: Use kebab-case, descriptive identifiers
2. **Semantic Versioning**: Follow semver for version management
3. **Comprehensive Parameters**: Define all required and optional parameters
4. **Type Safety**: Use proper parameter types and validation
5. **Clear Descriptions**: Document what each prompt and parameter does

### Variable Usage
1. **Meaningful Names**: Use descriptive variable names
2. **Consistent Patterns**: Follow established naming conventions
3. **Safe Defaults**: Provide sensible default values
4. **Validation**: Use patterns, enums, and ranges for validation

### Variant Strategy
1. **Simple Conditions**: Keep variant conditions easy to understand
2. **Clear Purpose**: Each variant should have a distinct use case
3. **Fallback Logic**: Always provide a default variant
4. **Documentation**: Explain when each variant is used

### Performance
1. **Caching**: Templates are cached automatically
2. **Lazy Loading**: Templates load only when needed
3. **Minimal Variants**: Don't create unnecessary variants
4. **Efficient Conditions**: Keep condition evaluation fast

## Testing Prompts

### Validation Testing
```javascript
// Test schema validation
const promptManager = getPromptManager();
const results = promptManager.validateAllPrompts();
console.log(`Valid: ${results.valid.length}, Errors: ${results.errors.length}`);
```

### Integration Testing
When modifying prompts, ensure to test:
- Variable substitution works with actual data structures
- Variant selection triggers correctly based on conditions
- AI responses remain consistent with expected behavior
- All parameters are properly validated
- Error handling works for invalid inputs

### Quick Testing
```javascript
// Test prompt loading and variable substitution
const promptManager = getPromptManager();
const result = promptManager.loadPrompt('research', {
  query: 'What are the latest React best practices?',
  detailLevel: 'medium',
  gatheredContext: 'React project with TypeScript'
});
console.log('System:', result.systemPrompt);
console.log('User:', result.userPrompt);
console.log('Metadata:', result.metadata);
```

### Testing Checklist
- [ ] Template validates against schema
- [ ] All required parameters are defined
- [ ] Variable substitution works correctly
- [ ] Variants trigger under correct conditions
- [ ] Error messages are clear and helpful
- [ ] Performance is acceptable for repeated usage

## Troubleshooting

### Common Issues

**Schema Validation Errors**:
- Check required fields are present
- Verify parameter types match schema
- Ensure version follows semantic versioning
- Validate JSON syntax

**Variable Substitution Problems**:
- Check variable names match parameter names
- Verify nested property access syntax
- Ensure array iteration syntax is correct
- Test with actual data structures

**Variant Selection Issues**:
- Verify condition syntax is valid JavaScript
- Check parameter values match condition expectations
- Ensure default variant exists
- Test condition evaluation with debug logging

**Performance Issues**:
- Check for circular references in templates
- Verify caching is working correctly
- Monitor template loading frequency
- Consider simplifying complex conditions
