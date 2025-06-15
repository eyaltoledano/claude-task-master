---
description: Guidelines for implementing and maintaining user interface components
globs: scripts/modules/ui.js
alwaysApply: false
---

# User Interface Implementation Guidelines

## Core UI Component Principles

- **Function Scope Separation**:
  - ✅ DO: Keep display logic separate from business logic
  - ✅ DO: Import data processing functions from other modules
  - ❌ DON'T: Include task manipulations within UI functions
  - ❌ DON'T: Create circular dependencies with other modules

- **Standard Display Pattern**:
  ```javascript
  // ✅ DO: Follow this pattern for display functions
  /**
   * Display information about a task
   * @param {Object} task - The task to display
   */
  function displayTaskInfo(task) {
    console.log(boxen(
      chalk.white.bold(`Task: #${task.id} - ${task.title}`),
      { padding: 1, borderColor: 'blue', borderStyle: 'round' }
    ));
  }
  ```

## Visual Styling Standards

- **Color Scheme**:
  - Use `chalk.blue` for informational messages
  - Use `chalk.green` for success messages
  - Use `chalk.yellow` for warnings
  - Use `chalk.red` for errors
  - Use `chalk.cyan` for prompts and highlights
  - Use `chalk.magenta` for subtask-related information

- **Box Styling**:
  ```javascript
  // ✅ DO: Use consistent box styles by content type
  // For success messages:
  boxen(content, { 
    padding: 1, 
    borderColor: 'green', 
    borderStyle: 'round', 
    margin: { top: 1 } 
  })

  // For errors:
  boxen(content, { 
    padding: 1, 
    borderColor: 'red', 
    borderStyle: 'round'
  })

  // For information:
  boxen(content, { 
    padding: 1, 
    borderColor: 'blue', 
    borderStyle: 'round', 
    margin: { top: 1, bottom: 1 } 
  })
  ```

## Table Display Guidelines

- **Table Structure**:
  - Use [`cli-table3`](mdc:node_modules/cli-table3/README.md) for consistent table rendering
  - Include colored headers with bold formatting
  - Use appropriate column widths for readability

  ```javascript
  // ✅ DO: Create well-structured tables
  const table = new Table({
    head: [
      chalk.cyan.bold('ID'),
      chalk.cyan.bold('Title'),
      chalk.cyan.bold('Status'),
      chalk.cyan.bold('Priority'),
      chalk.cyan.bold('Dependencies')
    ],
    colWidths: [5, 40, 15, 10, 20]
  });
  
  // Add content rows
  table.push([
    task.id,
    truncate(task.title, 37),
    getStatusWithColor(task.status),
    chalk.white(task.priority || 'medium'),
    formatDependenciesWithStatus(task.dependencies, allTasks, true)
  ]);
  
  console.log(table.toString());
  ```

## Loading Indicators

- **Animation Standards**:
  - Use [`ora`](mdc:node_modules/ora/readme.md) for spinner animations
  - Create and stop loading indicators correctly

  ```javascript
  // ✅ DO: Properly manage loading state
  const loadingIndicator = startLoadingIndicator('Processing task data...');
  try {
    // Do async work...
    stopLoadingIndicator(loadingIndicator);
    // Show success message
  } catch (error) {
    stopLoadingIndicator(loadingIndicator);
    // Show error message
  }
  ```

## Helper Functions

- **Status Formatting**:
  - Use `getStatusWithColor` for consistent status display
  - Use `formatDependenciesWithStatus` for dependency lists
  - Use `truncate` to handle text that may overflow display

- **Progress Reporting**:
  - Use visual indicators for progress (bars, percentages)
  - Include both numeric and visual representations
  
  ```javascript
  // ✅ DO: Show clear progress indicators
  console.log(`${chalk.cyan('Tasks:')} ${completedTasks}/${totalTasks} (${completionPercentage.toFixed(1)}%)`);
  console.log(`${chalk.cyan('Progress:')} ${createProgressBar(completionPercentage)}`);
  ```

## Command Suggestions

- **Action Recommendations**:
  - Provide next step suggestions after command completion
  - Use a consistent format for suggested commands

  ```javascript
  // ✅ DO: Show suggested next actions
  console.log(boxen(
    chalk.white.bold('Next Steps:') + '\n\n' +
    `${chalk.cyan('1.')} Run ${chalk.yellow('task-master list')} to view all tasks\n` +
    `${chalk.cyan('2.')} Run ${chalk.yellow('task-master show --id=' + newTaskId)} to view details`,
    { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
  ));
  ```

## Enhanced Display Patterns

### **Token Breakdown Display**
- Use detailed, granular token breakdowns for AI-powered commands
- Display context sources with individual token counts
- Show both token count and character count for transparency

  ```javascript
  // ✅ DO: Display detailed token breakdown
  function displayDetailedTokenBreakdown(tokenBreakdown, systemTokens, userTokens) {
    const sections = [];
    
    if (tokenBreakdown.tasks?.length > 0) {
      const taskDetails = tokenBreakdown.tasks.map(task => 
        `${task.type === 'subtask' ? '  ' : ''}${task.id}: ${task.tokens.toLocaleString()}`
      ).join('\n');
      sections.push(`Tasks (${tokenBreakdown.tasks.reduce((sum, t) => sum + t.tokens, 0).toLocaleString()}):\n${taskDetails}`);
    }
    
    const content = sections.join('\n\n');
    console.log(boxen(content, {
      title: chalk.cyan('Token Usage'),
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: 'cyan'
    }));
  }
  ```

### **Code Block Syntax Highlighting**
- Use `cli-highlight` library for syntax highlighting in terminal output
- Process code blocks in AI responses for better readability

  ```javascript
  // ✅ DO: Enhance code blocks with syntax highlighting
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

### **Multi-Section Result Display**
- Use separate boxes for headers, content, and metadata
- Maintain consistent styling across different result types

  ```javascript
  // ✅ DO: Use structured result display
  function displayResults(result, query, detailLevel) {
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
    
    // Process and display main content
    const processedResult = processCodeBlocks(result);
    const contentBox = boxen(processedResult, {
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      margin: { top: 0, bottom: 1 },
      borderStyle: 'single',
      borderColor: 'gray'
    });
    console.log(contentBox);
    
    console.log(chalk.green('✓ Operation complete'));
  }
  ```

Refer to [`ui.js`](mdc:scripts/modules/ui.js) for implementation examples, [`context_gathering.mdc`](mdc:.cursor/rules/context_gathering.mdc) for context display patterns, and [`new_features.mdc`](mdc:.cursor/rules/new_features.mdc) for integration guidelines. 