# Task Master JSON Schemas

This directory contains JSON schemas for validating Task Master prompt templates. These schemas provide IDE support, validation, and better developer experience when working with prompt templates.

## Schema Files

### `prompt-template.schema.json`
Main schema for Task Master prompt template files. Validates the complete structure including:
- Template metadata (id, version, description)
- Parameter definitions with type validation
- Prompt variants with conditional logic
- Cross-references between parameters and template variables

### `parameter.schema.json`
Reusable schema for individual prompt parameters. Supports:
- Type validation (string, number, boolean, array, object)
- Required/optional parameters
- Default values
- Enum constraints
- Pattern validation (regex)
- Range validation for numbers

### `variant.schema.json`
Schema for prompt template variants. Validates:
- System and user prompt templates
- Conditional expressions for variant selection
- Variable placeholders using Handlebars syntax
- Variant metadata and descriptions

## IDE Integration

### VS Code
When using the VS Code rule profile, schemas are automatically configured in `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": [
        ".taskmaster/docs/**/*.json",
        "src/prompts/**/*.json",
        ".taskmaster/prompts/**/*.json",
        "prompts/**/*.json"
      ],
      "url": "file:///absolute/path/to/.taskmaster/schemas/prompt-template.schema.json"
    }
  ]
}
```

### Other IDEs
For other development environments, configure JSON schema validation to use:
- Schema URL: `https://github.com/eyaltoledano/claude-task-master/schemas/prompt-template.json`
- File patterns: `**/*prompts/**/*.json`, `.taskmaster/**/*.json`

## Validation Features

### Structural Validation
- Required fields: `id`, `version`, `description`, `prompts`
- Proper nesting of prompt variants
- Valid semantic versioning format
- Alphanumeric ID format with hyphens

### Parameter Validation
- Type checking against declared parameter types
- Required parameter presence
- Enum value validation
- Pattern matching for string parameters
- Range validation for numeric parameters

### Template Validation
- Handlebars syntax validation
- Parameter reference consistency
- Conditional expression syntax
- Variable placeholder validation

## Usage Examples

### Basic Prompt Template
```json
{
  "id": "example-prompt",
  "version": "1.0.0",
  "description": "Example prompt template",
  "parameters": {
    "taskDescription": {
      "type": "string",
      "description": "Description of the task to perform",
      "required": true
    },
    "useResearch": {
      "type": "boolean",
      "description": "Whether to include research context",
      "required": false,
      "default": false
    }
  },
  "prompts": {
    "default": {
      "system": "You are a helpful AI assistant.",
      "user": "Please help with: {{taskDescription}}"
    },
    "research": {
      "condition": "useResearch === true",
      "system": "You are a research-focused AI assistant with access to current information.",
      "user": "Research and help with: {{taskDescription}}"
    }
  }
}
```

### Advanced Features
```json
{
  "id": "advanced-prompt",
  "version": "2.1.0",
  "description": "Advanced prompt with complex validation",
  "metadata": {
    "author": "Task Master Team",
    "category": "task",
    "tags": ["advanced", "validation"]
  },
  "parameters": {
    "priority": {
      "type": "string",
      "description": "Task priority level",
      "required": true,
      "enum": ["high", "medium", "low"]
    },
    "maxTokens": {
      "type": "number",
      "description": "Maximum tokens for response",
      "minimum": 100,
      "maximum": 4000,
      "default": 1000
    },
    "tags": {
      "type": "array",
      "description": "Task tags for categorization"
    }
  },
  "prompts": {
    "default": {
      "system": "Process this {{priority}} priority task with up to {{maxTokens}} tokens.",
      "user": "{{#if tags}}Tags: {{#each tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}\n{{/if}}Task details: {{description}}"
    }
  }
}
```

## CLI Validation

Use the CLI command to validate all prompt templates:

```bash
task-master validate-prompts --verbose
```

This command will:
- Check all prompt templates against the schema
- Validate parameter consistency
- Report any structural or validation errors
- Show detailed results with the `--verbose` flag

## Schema Evolution

When updating schemas:

1. **Maintain backward compatibility** when possible
2. **Update version numbers** in schema `$id` fields
3. **Test with existing templates** before releasing
4. **Document breaking changes** in release notes
5. **Provide migration guides** for major changes

## Contributing

When adding new prompt templates:

1. **Follow the schema** - all templates must validate
2. **Use descriptive IDs** - kebab-case, descriptive names
3. **Document parameters** - clear descriptions and types
4. **Test variants** - ensure conditional logic works correctly
5. **Validate before committing** - run `task-master validate-prompts`

## Schema URLs

- **Development**: Local file URIs in `.taskmaster/schemas/`
- **Production**: `https://github.com/eyaltoledano/claude-task-master/schemas/`
- **Raw GitHub**: `https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/assets/schemas/`

For the most up-to-date schemas, always reference the main branch on GitHub. 