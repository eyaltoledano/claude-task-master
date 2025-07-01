# Task Master JSON Schemas

This directory contains JSON schemas for validating Task Master prompt templates. These schemas provide IDE support, validation, and better developer experience when working with prompt templates.

## Overview

The schema system provides:
- **Structural Validation**: Ensures all required fields and proper JSON structure
- **Type Safety**: Validates parameter types and value constraints
- **IDE Integration**: IntelliSense and auto-completion in VS Code
- **Development Safety**: Catches errors before runtime
- **Documentation**: Self-documenting templates through schema definitions

## Schema Files

### `prompt-template.schema.json` (Main Schema)
**Version**: 1.0.0  
**Purpose**: Main schema for Task Master prompt template files

**Validates**:
- Template metadata (id, version, description)
- Parameter definitions with comprehensive type validation
- Prompt variants with conditional logic
- Cross-references between parameters and template variables
- Semantic versioning compliance
- Handlebars template syntax

**Required Fields**:
- `id`: Unique template identifier (kebab-case)
- `version`: Semantic version (e.g., "1.0.0")
- `description`: Human-readable description
- `prompts.default`: Default prompt variant

**Optional Fields**:
- `metadata`: Additional template information
- `parameters`: Parameter definitions for template variables
- `prompts.*`: Additional prompt variants

### `parameter.schema.json` (Parameter Schema)
**Version**: 1.0.0  
**Purpose**: Reusable schema for individual prompt parameters

**Supports**:
- **Type Validation**: `string`, `number`, `boolean`, `array`, `object`
- **Constraints**: Required/optional parameters, default values
- **String Validation**: Pattern matching (regex), enum constraints
- **Numeric Validation**: Minimum/maximum values, integer constraints
- **Array Validation**: Item types, minimum/maximum length
- **Object Validation**: Property definitions and required fields

**Parameter Properties**:
```json
{
  "type": "string|number|boolean|array|object",
  "required": true|false,
  "default": "any value matching type",
  "description": "Parameter documentation",
  "enum": ["option1", "option2"],
  "pattern": "^regex$",
  "minimum": 0,
  "maximum": 100,
  "minLength": 1,
  "maxLength": 255,
  "items": { "type": "string" },
  "properties": { "key": { "type": "string" } }
}
```

### `variant.schema.json` (Variant Schema)
**Version**: 1.0.0  
**Purpose**: Schema for prompt template variants

**Validates**:
- System and user prompt templates
- Conditional expressions for variant selection
- Variable placeholders using Handlebars syntax
- Variant metadata and descriptions

**Variant Structure**:
```json
{
  "condition": "JavaScript expression",
  "system": "System prompt template",
  "user": "User prompt template",
  "metadata": {
    "description": "When to use this variant"
  }
}
```

## Schema Validation Rules

### Template ID Validation
- **Pattern**: `^[a-z][a-z0-9-]*[a-z0-9]$`
- **Format**: Kebab-case, alphanumeric with hyphens
- **Examples**: 
  - ✅ `add-task`, `parse-prd`, `analyze-complexity`
  - ❌ `AddTask`, `add_task`, `-invalid-`, `task-`

### Version Validation
- **Pattern**: Semantic versioning (semver)
- **Format**: `MAJOR.MINOR.PATCH`
- **Examples**:
  - ✅ `1.0.0`, `2.1.3`, `10.0.0`
  - ❌ `1.0`, `v1.0.0`, `1.0.0-beta`

### Parameter Type Validation
- **String**: Text values with optional pattern/enum constraints
- **Number**: Numeric values with optional min/max constraints
- **Boolean**: True/false values
- **Array**: Lists with optional item type validation
- **Object**: Complex structures with property definitions

### Template Variable Validation
- **Handlebars Syntax**: `{{variable}}`, `{{#if condition}}`, `{{#each array}}`
- **Parameter References**: All template variables must have corresponding parameters
- **Nested Access**: Support for `{{object.property}}` notation
- **Special Variables**: `{{@index}}`, `{{@first}}`, `{{@last}}` in loops

## IDE Integration

### VS Code Setup
The VS Code profile automatically configures schema validation:

```json
{
  "json.schemas": [
    {
      "fileMatch": [
        "src/prompts/**/*.json",
        ".taskmaster/prompts/**/*.json",
        "prompts/**/*.json"
      ],
      "url": "./src/prompts/schemas/prompt-template.schema.json"
    }
  ]
}
```

**Features Provided**:
- **Auto-completion**: IntelliSense for all schema properties
- **Real-time Validation**: Immediate error highlighting
- **Hover Documentation**: Parameter descriptions on hover
- **Error Messages**: Detailed validation error explanations

### Other IDEs
For other development environments:

**Schema URLs**:
- **Local Development**: `./src/prompts/schemas/prompt-template.schema.json`
- **GitHub Reference**: `https://github.com/eyaltoledano/claude-task-master/blob/main/src/prompts/schemas/prompt-template.schema.json`

**File Patterns**:
- `src/prompts/**/*.json`
- `.taskmaster/prompts/**/*.json`
- `prompts/**/*.json`

## Validation Examples

### Valid Template Example
```json
{
  "id": "example-prompt",
  "version": "1.0.0",
  "description": "Example prompt template with comprehensive validation",
  "metadata": {
    "author": "Task Master Team",
    "category": "task",
    "tags": ["example", "validation"]
  },
  "parameters": {
    "taskDescription": {
      "type": "string",
      "description": "Description of the task to perform",
      "required": true,
      "minLength": 5,
      "maxLength": 500
    },
    "priority": {
      "type": "string",
      "description": "Task priority level",
      "required": false,
      "enum": ["high", "medium", "low"],
      "default": "medium"
    },
    "maxTokens": {
      "type": "number",
      "description": "Maximum tokens for response",
      "required": false,
      "minimum": 100,
      "maximum": 4000,
      "default": 1000
    },
    "useResearch": {
      "type": "boolean",
      "description": "Whether to include research context",
      "required": false,
      "default": false
    },
    "tags": {
      "type": "array",
      "description": "Task tags for categorization",
      "required": false,
      "items": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]*$"
      }
    }
  },
  "prompts": {
    "default": {
      "system": "You are a helpful AI assistant that creates tasks with {{priority}} priority.",
      "user": "Create a task: {{taskDescription}}{{#if tags}}\nTags: {{#each tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}"
    },
    "research": {
      "condition": "useResearch === true",
      "system": "You are a research-focused AI assistant with access to current information.",
      "user": "Research and create a task: {{taskDescription}}"
    }
  }
}
```

### Common Validation Errors

**Missing Required Fields**:
```json
// ❌ Error: Missing required 'id' field
{
  "version": "1.0.0",
  "description": "Missing ID"
}
```

**Invalid ID Format**:
```json
// ❌ Error: ID must be kebab-case
{
  "id": "InvalidID_Format",
  "version": "1.0.0"
}
```

**Parameter Type Mismatch**:
```json
// ❌ Error: Parameter type doesn't match usage
{
  "parameters": {
    "count": { "type": "string" }
  },
  "prompts": {
    "default": {
      "user": "Process {{count}} items" // Should be number for counting
    }
  }
}
```

**Invalid Condition Syntax**:
```json
// ❌ Error: Invalid JavaScript in condition
{
  "prompts": {
    "variant": {
      "condition": "useResearch = true", // Should be ===
      "user": "Research prompt"
    }
  }
}
```

## Development Workflow

### Creating New Templates
1. **Start with Schema**: Use VS Code with schema validation enabled
2. **Define Structure**: Begin with required fields (id, version, description)
3. **Add Parameters**: Define all template variables with proper types
4. **Create Prompts**: Write system and user prompts with template variables
5. **Test Validation**: Ensure template validates without errors
6. **Add Variants**: Create additional variants if needed
7. **Document Usage**: Update the main README with template details

### Modifying Existing Templates
1. **Check Current Version**: Note the current version number
2. **Assess Changes**: Determine if changes are breaking or non-breaking
3. **Update Version**: Increment version following semantic versioning
4. **Maintain Compatibility**: Avoid breaking existing parameter contracts
5. **Test Thoroughly**: Verify all existing code still works
6. **Update Documentation**: Reflect changes in README files

### Schema Evolution
When updating schemas themselves:

1. **Backward Compatibility**: Ensure existing templates remain valid
2. **Version Increment**: Update schema version in `$id` and `version` fields
3. **Test Migration**: Validate all existing templates against new schema
4. **Document Changes**: Update this README with schema changes
5. **Coordinate Release**: Ensure schema and template changes are synchronized

## Advanced Validation Features

### Cross-Reference Validation
The schema validates that:
- All template variables have corresponding parameters
- Parameter types match their usage in templates
- Variant conditions reference valid parameters
- Nested property access is properly defined

### Conditional Validation
- **Dynamic Schemas**: Different validation rules based on parameter values
- **Variant Conditions**: JavaScript expression validation
- **Template Syntax**: Handlebars syntax validation
- **Parameter Dependencies**: Required parameters based on other parameters

### Custom Validation Rules
The schema includes custom validation for:
- **Semantic Versioning**: Proper version format validation
- **Template Variables**: Handlebars syntax and parameter references
- **Condition Expressions**: JavaScript expression syntax validation
- **File Patterns**: Consistent naming conventions

## Performance Considerations

### Schema Loading
- **Caching**: Schemas are loaded once and cached
- **Lazy Loading**: Validation only occurs when templates are accessed
- **Memory Efficiency**: Shared schema instances across templates

### Validation Performance
- **Fast Validation**: AJV provides optimized validation
- **Error Batching**: Multiple errors reported in single validation pass
- **Minimal Overhead**: Validation adds minimal runtime cost

### Development Impact
- **IDE Responsiveness**: Real-time validation without performance impact
- **Build Time**: Schema validation during development, not production
- **Testing Speed**: Fast validation during test execution

## Troubleshooting

### Common Schema Issues

**Schema Not Loading**:
- Check file paths in VS Code settings
- Verify schema files exist and are valid JSON
- Restart VS Code if changes aren't recognized

**Validation Not Working**:
- Ensure `ajv` and `ajv-formats` dependencies are installed
- Check for JSON syntax errors in templates
- Verify schema file paths are correct

**Performance Issues**:
- Check for circular references in schemas
- Verify schema caching is working
- Monitor validation frequency in development

### Debugging Validation Errors

**Understanding Error Messages**:
```javascript
// Example error output
{
  "instancePath": "/parameters/priority/type",
  "schemaPath": "#/properties/parameters/additionalProperties/properties/type/enum",
  "keyword": "enum",
  "params": { "allowedValues": ["string", "number", "boolean", "array", "object"] },
  "message": "must be equal to one of the allowed values"
}
```

**Common Error Patterns**:
- `instancePath`: Shows where in the template the error occurred
- `schemaPath`: Shows which schema rule was violated
- `keyword`: Indicates the type of validation that failed
- `params`: Provides additional context about the validation rule
- `message`: Human-readable description of the error

### Getting Help

**Internal Resources**:
- Main prompt README: `src/prompts/README.md`
- Schema files: `src/prompts/schemas/*.json`
- PromptManager code: `scripts/modules/prompt-manager.js`

**External Resources**:
- JSON Schema documentation: https://json-schema.org/
- AJV validation library: https://ajv.js.org/
- Handlebars template syntax: https://handlebarsjs.com/

## Schema URLs and References

### Current Schema Locations
- **Local Development**: `./src/prompts/schemas/prompt-template.schema.json`
- **GitHub Blob**: `https://github.com/eyaltoledano/claude-task-master/blob/main/src/prompts/schemas/prompt-template.schema.json`
- **Schema ID**: Used for internal references and validation

### URL Usage Guidelines
- **`$id` Field**: Use GitHub blob URLs for stable schema identification
- **Local References**: Use relative paths for development and testing
- **External Tools**: GitHub blob URLs provide stable, version-controlled access
- **Documentation**: Link to GitHub for public schema access 