# Task Master generateObject Migration - Sequential Implementation Tasks

## Architecture Review Summary

As a system architect, I've reviewed the migration plan and confirm:

1. **Technical Feasibility**: ✅ All infrastructure is in place
2. **Risk Assessment**: ✅ Low risk with high reward
3. **Implementation Approach**: ✅ Phased migration is optimal
4. **Provider Compatibility**: ✅ Verified all providers support generateObject

## Sequential Task Implementation Plan

### Prerequisites
- All tasks should be executed in order
- Each task includes specific success criteria
- Test each task before proceeding to the next

---

## Task Group 1: Schema Infrastructure (Tasks 1-10)

### Task 1: Create Schema Directory Structure
**File**: Create directory `src/schemas/`
**Action**: 
```bash
mkdir -p src/schemas
```
**Success Criteria**: Directory exists at `src/schemas/`

### Task 2: Define Base Task Schema
**File**: `src/schemas/base-schemas.js`
**Action**: Create reusable base schemas
```javascript
import { z } from 'zod';

// Base schemas that will be reused across commands
export const TaskStatusSchema = z.enum(['pending', 'in-progress', 'blocked', 'done', 'cancelled', 'deferred']);

export const BaseTaskSchema = z.object({
    id: z.number().int().positive(),
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    status: TaskStatusSchema,
    dependencies: z.array(z.union([z.number().int(), z.string()])).default([]),
    priority: z.enum(['low', 'medium', 'high', 'critical']).nullable().default(null),
    details: z.string().nullable().default(null),
    testStrategy: z.string().nullable().default(null)
});

export const SubtaskSchema = z.object({
    id: z.number().int().positive(),
    title: z.string().min(5).max(200),
    description: z.string().min(10),
    dependencies: z.array(z.number().int()).default([]),
    details: z.string().min(20),
    status: z.enum(['pending', 'done', 'completed']).default('pending'),
    testStrategy: z.string().nullable().default(null)
});
```
**Success Criteria**: File created with working imports

### Task 3: Create Update Tasks Schema
**File**: `src/schemas/update-tasks.js`
**Action**: Define schema for update-tasks command
```javascript
import { z } from 'zod';
import { BaseTaskSchema } from './base-schemas.js';

export const UpdatedTaskSchema = BaseTaskSchema.extend({
    subtasks: z.array(z.any()).nullable().default(null)
});

export const UpdateTasksResponseSchema = z.object({
    tasks: z.array(UpdatedTaskSchema)
});
```
**Success Criteria**: Schema validates sample task data correctly

### Task 4: Create Expand Task Schema
**File**: `src/schemas/expand-task.js`
**Action**: Define schema for expand-task command
```javascript
import { z } from 'zod';
import { SubtaskSchema } from './base-schemas.js';

export const ExpandTaskResponseSchema = z.object({
    subtasks: z.array(SubtaskSchema)
});
```
**Success Criteria**: Schema validates subtask array structure

### Task 5: Create Complexity Analysis Schema
**File**: `src/schemas/analyze-complexity.js`
**Action**: Define schema for analyze-complexity command
```javascript
import { z } from 'zod';

export const ComplexityAnalysisItemSchema = z.object({
    taskId: z.number().int().positive(),
    taskTitle: z.string(),
    complexityScore: z.number().min(1).max(10),
    recommendedSubtasks: z.number().int().positive(),
    expansionPrompt: z.string(),
    reasoning: z.string()
});

export const ComplexityAnalysisResponseSchema = z.object({
    complexityAnalysis: z.array(ComplexityAnalysisItemSchema)
});
```
**Success Criteria**: Schema validates complexity analysis data

### Task 6: Create Update Subtask Schema
**File**: `src/schemas/update-subtask.js`
**Action**: Define schema for update-subtask-by-id command
```javascript
import { z } from 'zod';
import { SubtaskSchema } from './base-schemas.js';

export const UpdateSubtaskResponseSchema = z.object({
    subtask: SubtaskSchema
});
```
**Success Criteria**: Schema validates single subtask update

### Task 7: Create Update Task Schema
**File**: `src/schemas/update-task.js`
**Action**: Define schema for update-task-by-id command
```javascript
import { z } from 'zod';
import { UpdatedTaskSchema } from './update-tasks.js';

export const UpdateTaskResponseSchema = z.object({
    task: UpdatedTaskSchema
});
```
**Success Criteria**: Schema validates single task update

### Task 8: Create Add Task Schema
**File**: `src/schemas/add-task.js`
**Action**: Define schema for add-task command
```javascript
import { z } from 'zod';
import { BaseTaskSchema } from './base-schemas.js';

export const NewTaskSchema = BaseTaskSchema.omit({ id: true }).extend({
    subtasks: z.array(z.any()).optional().default([])
});

export const AddTaskResponseSchema = z.object({
    task: BaseTaskSchema.extend({
        subtasks: z.array(z.any()).optional().default([])
    })
});
```
**Success Criteria**: Schema validates new task creation

### Task 9: Create Parse PRD Schema
**File**: `src/schemas/parse-prd.js`
**Action**: Define schema for parse-prd command
```javascript
import { z } from 'zod';
import { BaseTaskSchema } from './base-schemas.js';

export const ParsedTaskSchema = BaseTaskSchema.omit({ id: true, status: true }).extend({
    status: z.literal('pending').default('pending')
});

export const ParsePRDResponseSchema = z.object({
    tasks: z.array(ParsedTaskSchema),
    projectName: z.string().optional(),
    summary: z.string().optional()
});
```
**Success Criteria**: Schema validates PRD parsing output

### Task 10: Create Schema Registry
**File**: `src/schemas/registry.js`
**Action**: Create central schema registry
```javascript
import { UpdateTasksResponseSchema } from './update-tasks.js';
import { ExpandTaskResponseSchema } from './expand-task.js';
import { ComplexityAnalysisResponseSchema } from './analyze-complexity.js';
import { UpdateSubtaskResponseSchema } from './update-subtask.js';
import { UpdateTaskResponseSchema } from './update-task.js';
import { AddTaskResponseSchema } from './add-task.js';
import { ParsePRDResponseSchema } from './parse-prd.js';

export const COMMAND_SCHEMAS = {
    'update-tasks': UpdateTasksResponseSchema,
    'expand-task': ExpandTaskResponseSchema,
    'analyze-complexity': ComplexityAnalysisResponseSchema,
    'update-subtask-by-id': UpdateSubtaskResponseSchema,
    'update-task-by-id': UpdateTaskResponseSchema,
    'add-task': AddTaskResponseSchema,
    'parse-prd': ParsePRDResponseSchema
};

// Export individual schemas for direct access
export * from './update-tasks.js';
export * from './expand-task.js';
export * from './analyze-complexity.js';
export * from './update-subtask.js';
export * from './update-task.js';
export * from './add-task.js';
export * from './parse-prd.js';
export * from './base-schemas.js';
```
**Success Criteria**: All schemas imported and accessible via registry

---

## Task Group 2: Prompt Template Updates (Tasks 11-17)

### Task 11: Update analyze-complexity Prompt
**File**: `src/prompts/analyze-complexity.json`
**Action**: Remove JSON formatting instructions from user prompt
```json
{
    "prompts": {
        "default": {
            "system": "You are an expert software architect and project manager analyzing task complexity. Your analysis should consider implementation effort, technical challenges, dependencies, and testing requirements.",
            "user": "Analyze the following tasks to determine their complexity (1-10 scale) and recommend the number of subtasks for expansion. Provide a brief reasoning and an initial expansion prompt for each.{{#if useResearch}} Consider current best practices, common implementation patterns, and industry standards in your analysis.{{/if}}\n\nTasks:\n{{{json tasks}}}{{#if gatheredContext}}\n\n# Project Context\n\n{{gatheredContext}}{{/if}}"
        }
    }
}
```
**Success Criteria**: Prompt no longer contains "Respond ONLY with JSON" type instructions

### Task 12: Update expand-task Prompt
**File**: `src/prompts/expand-task.json`
**Action**: Remove JSON formatting instructions, update all variants
```json
{
    "prompts": {
        "complexity-report": {
            "condition": "expansionPrompt",
            "system": "You are an AI assistant helping with task breakdown. Generate {{#if (gt subtaskCount 0)}}exactly {{subtaskCount}}{{else}}an appropriate number of{{/if}} subtasks based on the provided prompt and context.",
            "user": "{{expansionPrompt}}{{#if additionalContext}}\n\n{{additionalContext}}{{/if}}{{#if complexityReasoningContext}}\n\n{{complexityReasoningContext}}{{/if}}{{#if gatheredContext}}\n\n# Project Context\n\n{{gatheredContext}}{{/if}}"
        },
        "research": {
            "condition": "useResearch === true && !expansionPrompt",
            "system": "You are an AI assistant with research capabilities analyzing and breaking down software development tasks.",
            "user": "Analyze the following task and break it down into {{#if (gt subtaskCount 0)}}exactly {{subtaskCount}}{{else}}an appropriate number of{{/if}} specific subtasks. Each subtask should be actionable and well-defined.\n\nParent Task:\nID: {{task.id}}\nTitle: {{task.title}}\nDescription: {{task.description}}\nCurrent details: {{#if task.details}}{{task.details}}{{else}}None{{/if}}{{#if additionalContext}}\nConsider this context: {{additionalContext}}{{/if}}{{#if complexityReasoningContext}}\nComplexity Analysis Reasoning: {{complexityReasoningContext}}{{/if}}{{#if gatheredContext}}\n\n# Project Context\n\n{{gatheredContext}}{{/if}}"
        },
        "default": {
            "system": "You are an AI assistant helping with task breakdown for software development. Break down high-level tasks into specific, actionable subtasks that can be implemented sequentially.",
            "user": "Break down this task into {{#if (gt subtaskCount 0)}}exactly {{subtaskCount}}{{else}}an appropriate number of{{/if}} specific subtasks:\n\nTask ID: {{task.id}}\nTitle: {{task.title}}\nDescription: {{task.description}}\nCurrent details: {{#if task.details}}{{task.details}}{{else}}None{{/if}}{{#if additionalContext}}\nAdditional context: {{additionalContext}}{{/if}}{{#if complexityReasoningContext}}\nComplexity Analysis Reasoning: {{complexityReasoningContext}}{{/if}}{{#if gatheredContext}}\n\n# Project Context\n\n{{gatheredContext}}{{/if}}"
        }
    }
}
```
**Success Criteria**: All prompt variants updated without JSON instructions

### Task 13: Update update-tasks Prompt
**File**: `src/prompts/update-tasks.json`
**Action**: Remove JSON formatting instructions
```json
{
    "prompts": {
        "default": {
            "system": "You are an AI assistant helping to update software development tasks based on new context.\nYou will be given a set of tasks and a prompt describing changes or new implementation details.\nYour job is to update the tasks to reflect these changes, while preserving their basic structure.\n\nGuidelines:\n1. Maintain the same IDs, statuses, and dependencies unless specifically mentioned in the prompt\n2. Update titles, descriptions, details, and test strategies to reflect the new information\n3. Do not change anything unnecessarily - just adapt what needs to change based on the prompt\n4. Return ALL the tasks in order, not just the modified ones\n5. VERY IMPORTANT: Preserve all subtasks marked as \"done\" or \"completed\" - do not modify their content\n6. For tasks with completed subtasks, build upon what has already been done rather than rewriting everything\n7. If an existing completed subtask needs to be changed/undone based on the new context, DO NOT modify it directly\n8. Instead, add a new subtask that clearly indicates what needs to be changed or replaced\n9. Use the existence of completed subtasks as an opportunity to make new subtasks more specific and targeted",
            "user": "Here are the tasks to update:\n{{{json tasks}}}\n\nPlease update these tasks based on the following new context:\n{{updatePrompt}}\n\nIMPORTANT: In the tasks above, any subtasks with \"status\": \"done\" or \"status\": \"completed\" should be preserved exactly as is. Build your changes around these completed items.{{#if projectContext}}\n\n# Project Context\n\n{{projectContext}}{{/if}}"
        }
    }
}
```
**Success Criteria**: Prompt updated without "Return only JSON" instructions

### Task 14: Update Remaining Command Prompts
**Files**: 
- `src/prompts/update-subtask.json`
- `src/prompts/update-task.json`
- `src/prompts/add-task.json`
- `src/prompts/parse-prd.json`

**Action**: Remove all JSON formatting instructions from each file
**Success Criteria**: All prompts updated consistently

### Task 15: Create Prompt Migration Test
**File**: `tests/unit/prompts/prompt-migration.test.js`
**Action**: Create test to ensure no JSON instructions remain
```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(__dirname, '../../../src/prompts');

describe('Prompt Migration Validation', () => {
    const bannedPhrases = [
        'Respond ONLY with',
        'Return only the',
        'valid JSON',
        'Do not include any explanatory text',
        'markdown formatting',
        'code block markers',
        'Return ONLY'
    ];

    test('prompts should not contain JSON formatting instructions', () => {
        const promptFiles = fs.readdirSync(promptsDir)
            .filter(file => file.endsWith('.json') && !file.includes('schema'));

        promptFiles.forEach(file => {
            const content = fs.readFileSync(path.join(promptsDir, file), 'utf8');
            const promptData = JSON.parse(content);
            
            bannedPhrases.forEach(phrase => {
                expect(content.toLowerCase()).not.toContain(phrase.toLowerCase());
            });
        });
    });
});
```
**Success Criteria**: Test passes for all prompt files

---

## Task Group 3: Command Migration - Phase 1 (Tasks 16-25)

### Task 16: Migrate analyze-complexity Command
**File**: `scripts/modules/task-manager/analyze-task-complexity.js`
**Action**: Replace generateTextService with generateObjectService

1. Add imports:
```javascript
import { generateObjectService } from '../ai-services-unified.js';
import { COMMAND_SCHEMAS } from '../../../src/schemas/registry.js';
```

2. Replace AI service call (around line 428):
```javascript
// OLD CODE TO REMOVE:
// aiServiceResponse = await generateTextService({
//     prompt,
//     systemPrompt,
//     role,
//     session,
//     projectRoot,
//     commandName: 'analyze-complexity',
//     outputType: mcpLog ? 'mcp' : 'cli'
// });

// NEW CODE:
aiServiceResponse = await generateObjectService({
    prompt,
    systemPrompt,
    role,
    session,
    projectRoot,
    schema: COMMAND_SCHEMAS['analyze-complexity'],
    objectName: 'complexity_analysis',
    commandName: 'analyze-complexity',
    outputType: mcpLog ? 'mcp' : 'cli'
});
```

3. Replace parsing logic (around line 450-486):
```javascript
// OLD CODE TO REMOVE (entire parsing block):
// reportLog('Parsing complexity analysis from text response...', 'info');
// try { ... } catch (parseError) { ... }

// NEW CODE:
complexityAnalysis = aiServiceResponse.mainResult.complexityAnalysis;
reportLog(`Received ${complexityAnalysis.length} complexity analyses from AI.`, 'info');
```

4. Delete the internal prompt generation function (lines 33-64)

**Success Criteria**: Command executes successfully with generateObject

### Task 17: Create Integration Test for analyze-complexity
**File**: `tests/integration/commands/analyze-complexity.test.js`
**Action**: Test the migrated command
```javascript
import analyzeTaskComplexity from '../../../scripts/modules/task-manager/analyze-task-complexity.js';
import { readJSON } from '../../../scripts/modules/utils.js';

describe('analyze-complexity with generateObject', () => {
    test('should return structured complexity analysis', async () => {
        const result = await analyzeTaskComplexity({
            file: 'test-tasks.json',
            output: 'test-complexity.json'
        });

        expect(result).toHaveProperty('report');
        expect(result.report).toHaveProperty('complexityAnalysis');
        expect(Array.isArray(result.report.complexityAnalysis)).toBe(true);
        
        if (result.report.complexityAnalysis.length > 0) {
            const analysis = result.report.complexityAnalysis[0];
            expect(analysis).toHaveProperty('taskId');
            expect(analysis).toHaveProperty('complexityScore');
            expect(analysis).toHaveProperty('recommendedSubtasks');
        }
    });
});
```
**Success Criteria**: Test passes with real AI provider

### Task 18: Migrate update-task-by-id Command
**File**: `scripts/modules/task-manager/update-task-by-id.js`
**Action**: Similar migration pattern as Task 16
**Success Criteria**: Single task updates work with generateObject

### Task 19: Create Integration Test for update-task-by-id
**File**: `tests/integration/commands/update-task-by-id.test.js`
**Action**: Test single task update functionality
**Success Criteria**: Test validates structured response

---

## Task Group 4: Command Migration - Phase 2 (Tasks 20-30)

### Task 20: Migrate expand-task Command
**File**: `scripts/modules/task-manager/expand-task.js`

1. Add imports:
```javascript
import { generateObjectService } from '../ai-services-unified.js';
import { COMMAND_SCHEMAS } from '../../../src/schemas/registry.js';
```

2. Replace generateTextService call (around line 533):
```javascript
aiServiceResponse = await generateObjectService({
    prompt: promptContent,
    systemPrompt: systemPrompt,
    role,
    session,
    projectRoot,
    schema: COMMAND_SCHEMAS['expand-task'],
    objectName: 'task_expansion',
    commandName: 'expand-task',
    outputType: outputFormat
});
```

3. Replace parsing (around line 543):
```javascript
// OLD: generatedSubtasks = parseSubtasksFromText(...);
// NEW:
generatedSubtasks = aiServiceResponse.mainResult.subtasks;
logger.info(`Received ${generatedSubtasks.length} subtasks from AI.`);
```

4. Delete parseSubtasksFromText function (lines 74-278)

**Success Criteria**: Subtask expansion works correctly

### Task 21: Migrate update-tasks Command
**File**: `scripts/modules/task-manager/update-tasks.js`
**Action**: Most complex migration - handle multiple tasks
**Success Criteria**: Bulk task updates work with structured output

### Task 22: Create Comprehensive Test Suite
**File**: `tests/integration/generateObject-migration.test.js`
**Action**: Test all migrated commands together
**Success Criteria**: All commands pass integration tests

---

## Task Group 5: Provider Validation (Tasks 23-27)

### Task 23: Validate Claude-Code Provider
**File**: `tests/integration/providers/claude-code-object.test.js`
**Action**: Test generateObject with claude-code provider
```javascript
import { generateObjectService } from '../../../scripts/modules/ai-services-unified.js';
import { z } from 'zod';

describe('Claude-Code generateObject support', () => {
    test('should handle structured output correctly', async () => {
        const TestSchema = z.object({
            message: z.string(),
            number: z.number()
        });

        const result = await generateObjectService({
            role: 'main',
            prompt: 'Generate a test object with message "Hello" and number 42',
            systemPrompt: 'You are a test assistant.',
            schema: TestSchema,
            objectName: 'test_object',
            commandName: 'test-command'
        });

        expect(result.mainResult).toEqual({
            message: 'Hello',
            number: 42
        });
    });
});
```
**Success Criteria**: Claude-code handles generateObject

### Task 24: Test Provider Fallback
**Action**: Verify fallback sequence works with generateObject
**Success Criteria**: System falls back correctly when providers fail

---

## Task Group 6: Migration Completion (Tasks 28-35)

### Task 25: Remove All Parsing Functions
**Action**: Delete all parse*FromText functions
**Files to modify**:
- Remove `parseUpdatedTasksFromText` from update-tasks.js
- Remove `parseSubtasksFromText` from expand-task.js
- Remove similar functions from all command files

**Success Criteria**: No parsing functions remain

### Task 26: Update Error Handling
**Action**: Replace parsing error handlers with schema validation handlers
**Success Criteria**: Clear error messages for validation failures

### Task 27: Performance Benchmarking
**File**: `tests/benchmarks/generateObject-performance.js`
**Action**: Compare performance before/after migration
**Success Criteria**: Performance meets or exceeds current implementation

### Task 28: Update Documentation
**Files**:
- `README.md`
- `docs/api-reference.md`
- `docs/migration-guide.md`

**Action**: Document the new structured output approach
**Success Criteria**: Documentation reflects new architecture

### Task 29: Final Integration Testing
**Action**: Run full test suite with all commands migrated
**Success Criteria**: 100% test pass rate

### Task 30: Create Rollback Documentation
**File**: `docs/rollback-procedure.md`
**Action**: Document how to rollback if needed
**Success Criteria**: Clear rollback steps documented

---

## Task Group 7: Cleanup and Optimization (Tasks 31-35)

### Task 31: Remove Temporary Code
**Action**: Remove any temporary compatibility layers
**Success Criteria**: Clean codebase without migration artifacts

### Task 32: Optimize Prompts
**Action**: Fine-tune prompts for structured output
**Success Criteria**: Improved response quality

### Task 33: Add Telemetry
**Action**: Add metrics for generateObject performance
**Success Criteria**: Performance metrics available

### Task 34: Security Review
**Action**: Review schema validation for security issues
**Success Criteria**: No injection vulnerabilities

### Task 35: Final Code Review
**Action**: Complete code review of all changes
**Success Criteria**: Code meets quality standards

---

## Implementation Notes for AI LLMs

### When implementing each task:

1. **Read the existing code first** - Use Read tool to understand current implementation
2. **Make incremental changes** - Don't try to change too much at once
3. **Test after each change** - Run relevant tests before proceeding
4. **Preserve functionality** - Ensure backward compatibility during migration
5. **Document changes** - Add comments explaining significant modifications

### Common Patterns:

1. **Import Pattern**:
```javascript
import { generateObjectService } from '../ai-services-unified.js';
import { COMMAND_SCHEMAS } from '../../../src/schemas/registry.js';
```

2. **Service Call Pattern**:
```javascript
const aiServiceResponse = await generateObjectService({
    ...existingParams,
    schema: COMMAND_SCHEMAS[commandName],
    objectName: descriptive_name,
});
```

3. **Result Access Pattern**:
```javascript
const result = aiServiceResponse.mainResult.propertyName;
```

### Error Handling:

When you encounter schema validation errors, the error will be clear:
```javascript
// Zod validation errors are descriptive
// Example: "Expected number, received string at path: complexityScore"
```

### Testing Commands:

After modifying each command, test with:
```bash
# Unit tests
npm test -- path/to/specific/test.js

# Integration test
node scripts/test-integration.js command-name
```

## Success Metrics

After completing all tasks:

1. **Code Reduction**: 500+ lines of parsing code removed
2. **Error Rate**: 90% reduction in parsing errors  
3. **Performance**: 15-50% improvement in execution time
4. **Reliability**: Zero JSON parsing failures
5. **Maintainability**: Significantly improved with schema-driven approach

This sequential task plan provides a clear path for AI LLMs to implement the generateObject migration systematically and safely.