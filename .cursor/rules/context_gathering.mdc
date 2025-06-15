---
description: Standardized patterns for gathering and processing context from multiple sources in Task Master commands, particularly for AI-powered features.
globs: 
alwaysApply: false
---
# Context Gathering Patterns and Utilities

This document outlines the standardized patterns for gathering and processing context from multiple sources in Task Master commands, particularly for AI-powered features.

## Core Context Gathering Utility

The `ContextGatherer` class (`scripts/modules/utils/contextGatherer.js`) provides a centralized, reusable utility for extracting context from multiple sources:

### **Key Features**
- **Multi-source Context**: Tasks, files, custom text, project file tree
- **Token Counting**: Detailed breakdown using `gpt-tokens` library
- **Format Support**: Different output formats (research, chat, system-prompt)
- **Error Handling**: Graceful handling of missing files, invalid task IDs
- **Performance**: File size limits, depth limits for tree generation

### **Usage Pattern**
```javascript
import { ContextGatherer } from '../utils/contextGatherer.js';

// Initialize with project paths
const gatherer = new ContextGatherer(projectRoot, tasksPath);

// Gather context with detailed token breakdown
const result = await gatherer.gather({
    tasks: ['15', '16.2'],           // Task and subtask IDs
    files: ['src/api.js', 'README.md'], // File paths
    customContext: 'Additional context text',
    includeProjectTree: true,        // Include file tree
    format: 'research',              // Output format
    includeTokenCounts: true         // Get detailed token breakdown
});

// Access results
const contextString = result.context;
const tokenBreakdown = result.tokenBreakdown;
```

### **Token Breakdown Structure**
```javascript
{
    customContext: { tokens: 150, characters: 800 },
    tasks: [
        { id: '15', type: 'task', title: 'Task Title', tokens: 245, characters: 1200 },
        { id: '16.2', type: 'subtask', title: 'Subtask Title', tokens: 180, characters: 900 }
    ],
    files: [
        { path: 'src/api.js', tokens: 890, characters: 4500, size: '4.5 KB' }
    ],
    projectTree: { tokens: 320, characters: 1600 },
    total: { tokens: 1785, characters: 8000 }
}
```

## Fuzzy Search Integration

The `FuzzyTaskSearch` class (`scripts/modules/utils/fuzzyTaskSearch.js`) provides intelligent task discovery:

### **Key Features**
- **Semantic Matching**: Uses Fuse.js for similarity scoring
- **Purpose Categories**: Pattern-based task categorization
- **Relevance Scoring**: High/medium/low relevance thresholds
- **Context-Aware**: Different search configurations for different use cases

### **Usage Pattern**
```javascript
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';

// Initialize with tasks data and context
const fuzzySearch = new FuzzyTaskSearch(tasksData.tasks, 'research');

// Find relevant tasks
const searchResults = fuzzySearch.findRelevantTasks(query, {
    maxResults: 8,
    includeRecent: true,
    includeCategoryMatches: true
});

// Get task IDs for context gathering
const taskIds = fuzzySearch.getTaskIds(searchResults);
```

## Implementation Patterns for Commands

### **1. Context-Aware Command Structure**
```javascript
// In command action handler
async function commandAction(prompt, options) {
    // 1. Parameter validation and parsing
    const taskIds = options.id ? parseTaskIds(options.id) : [];
    const filePaths = options.files ? parseFilePaths(options.files) : [];
    
    // 2. Initialize context gatherer
    const projectRoot = findProjectRoot() || '.';
    const tasksPath = path.join(projectRoot, 'tasks', 'tasks.json');
    const gatherer = new ContextGatherer(projectRoot, tasksPath);
    
    // 3. Auto-discover relevant tasks if none specified
    if (taskIds.length === 0) {
        const fuzzySearch = new FuzzyTaskSearch(tasksData.tasks, 'research');
        const discoveredIds = fuzzySearch.getTaskIds(
            fuzzySearch.findRelevantTasks(prompt)
        );
        taskIds.push(...discoveredIds);
    }
    
    // 4. Gather context with token breakdown
    const contextResult = await gatherer.gather({
        tasks: taskIds,
        files: filePaths,
        customContext: options.context,
        includeProjectTree: options.projectTree,
        format: 'research',
        includeTokenCounts: true
    });
    
    // 5. Display token breakdown (for CLI)
    if (outputFormat === 'text') {
        displayDetailedTokenBreakdown(contextResult.tokenBreakdown);
    }
    
    // 6. Use context in AI call
    const aiResult = await generateTextService(role, session, systemPrompt, userPrompt);
    
    // 7. Display results with enhanced formatting
    displayResults(aiResult, contextResult.tokenBreakdown);
}
```

### **2. Token Display Pattern**
```javascript
function displayDetailedTokenBreakdown(tokenBreakdown, systemTokens, userTokens) {
    const sections = [];
    
    // Build context breakdown
    if (tokenBreakdown.tasks?.length > 0) {
        const taskDetails = tokenBreakdown.tasks.map(task => 
            `${task.type === 'subtask' ? '  ' : ''}${task.id}: ${task.tokens.toLocaleString()}`
        ).join('\n');
        sections.push(`Tasks (${tokenBreakdown.tasks.reduce((sum, t) => sum + t.tokens, 0).toLocaleString()}):\n${taskDetails}`);
    }
    
    if (tokenBreakdown.files?.length > 0) {
        const fileDetails = tokenBreakdown.files.map(file =>
            `  ${file.path}: ${file.tokens.toLocaleString()} (${file.size})`
        ).join('\n');
        sections.push(`Files (${tokenBreakdown.files.reduce((sum, f) => sum + f.tokens, 0).toLocaleString()}):\n${fileDetails}`);
    }
    
    // Add prompts breakdown
    sections.push(`Prompts: system ${systemTokens.toLocaleString()}, user ${userTokens.toLocaleString()}`);
    
    // Display in clean box
    const content = sections.join('\n\n');
    console.log(boxen(content, {
        title: chalk.cyan('Token Usage'),
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'cyan'
    }));
}
```

### **3. Enhanced Result Display Pattern**
```javascript
function displayResults(result, query, detailLevel, tokenBreakdown) {
    // Header with query info
    const header = boxen(
        chalk.green.bold('Research Results') + '\n\n' +
        chalk.gray('Query: ') + chalk.white(query) + '\n' +
        chalk.gray('Detail Level: ') + chalk.cyan(detailLevel),
        {
            padding: { top: 1, bottom: 1, left: 2, right: 2 },
            margin: { top: 1, bottom: 0 },
            borderStyle: 'round',
            borderColor: 'green'
        }
    );
    console.log(header);
    
    // Process and highlight code blocks
    const processedResult = processCodeBlocks(result);
    
    // Main content in clean box
    const contentBox = boxen(processedResult, {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        margin: { top: 0, bottom: 1 },
        borderStyle: 'single',
        borderColor: 'gray'
    });
    console.log(contentBox);
    
    console.log(chalk.green('✓ Research complete'));
}
```

## Code Block Enhancement

### **Syntax Highlighting Pattern**
```javascript
import { highlight } from 'cli-highlight';

function processCodeBlocks(text) {
    return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
        try {
            const highlighted = highlight(code.trim(), { 
                language: language || 'javascript',
                theme: 'default'
            });
            return `\n${highlighted}\n`;
        } catch (error) {
            return `\n${code.trim()}\n`;
        }
    });
}
```

## Integration Guidelines

### **When to Use Context Gathering**
- ✅ **DO**: Use for AI-powered commands that benefit from project context
- ✅ **DO**: Use when users might want to reference specific tasks or files
- ✅ **DO**: Use for research, analysis, or generation commands
- ❌ **DON'T**: Use for simple CRUD operations that don't need AI context

### **Performance Considerations**
- ✅ **DO**: Set reasonable file size limits (50KB default)
- ✅ **DO**: Limit project tree depth (3-5 levels)
- ✅ **DO**: Provide token counts to help users understand context size
- ✅ **DO**: Allow users to control what context is included

### **Error Handling**
- ✅ **DO**: Gracefully handle missing files with warnings
- ✅ **DO**: Validate task IDs and provide helpful error messages
- ✅ **DO**: Continue processing even if some context sources fail
- ✅ **DO**: Provide fallback behavior when context gathering fails

### **Future Command Integration**
Commands that should consider adopting this pattern:
- `analyze-complexity` - Could benefit from file context
- `expand-task` - Could use related task context
- `update-task` - Could reference similar tasks for consistency
- `add-task` - Could use project context for better task generation

## Export Patterns

### **Context Gatherer Module**
```javascript
export {
    ContextGatherer,
    createContextGatherer  // Factory function
};
```

### **Fuzzy Search Module**
```javascript
export {
    FuzzyTaskSearch,
    PURPOSE_CATEGORIES,
    RELEVANCE_THRESHOLDS
};
```

This context gathering system provides a foundation for building more intelligent, context-aware commands that can leverage project knowledge to provide better AI-powered assistance.
