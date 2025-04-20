/**
 * Markdown Renderer Module
 * 
 * Provides utilities for rendering Markdown content in the terminal
 * using marked and marked-terminal
 */

import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';

// Configure marked with terminal renderer
marked.use(markedTerminal({
  // Custom styling for elements
  code: chalk.yellow,
  codespan: chalk.yellow,
  strong: chalk.bold,
  em: chalk.italic,
  heading: chalk.bold.cyan,
  listitem: (text) => `  • ${text}`,
  table: {
    chars: {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│'
    },
    style: {
      head: ['cyan', 'bold'],
      border: ['gray'],
    }
  }
}));

/**
 * Render task content as rich text
 * @param {string} content - Raw task content
 * @returns {string} - Formatted rich text output
 */
export function renderTaskContent(content) {
  // Convert task file format to proper markdown
  const markdownContent = convertTaskToMarkdown(content);
  
  // Parse the markdown using marked
  return marked.parse(markdownContent);
}

/**
 * Converts task file format to proper markdown
 * @param {string} content - Raw task content
 * @returns {string} - Converted markdown
 */
function convertTaskToMarkdown(content) {
  // Split content by lines
  const lines = content.split('\n');
  let markdown = '';
  let inDetailsSection = false;
  let inTestSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Convert # Task ID: to proper heading
    if (line.startsWith('# Task ID:')) {
      const taskId = line.replace('# Task ID:', '').trim();
      markdown += `# Task ${taskId}\n\n`;
    }
    // Convert # Title: to proper heading
    else if (line.startsWith('# Title:')) {
      const title = line.replace('# Title:', '').trim();
      markdown += `## ${title}\n\n`;
    }
    // Convert # Status: to a badge-like format
    else if (line.startsWith('# Status:')) {
      const status = line.replace('# Status:', '').trim();
      markdown += `**Status:** ${status}\n\n`;
    }
    // Convert # Dependencies: to a list
    else if (line.startsWith('# Dependencies:')) {
      const deps = line.replace('# Dependencies:', '').trim();
      markdown += `**Dependencies:** ${deps}\n\n`;
    }
    // Convert # Priority: to emphasized text
    else if (line.startsWith('# Priority:')) {
      const priority = line.replace('# Priority:', '').trim();
      markdown += `**Priority:** ${priority}\n\n`;
    }
    // Convert # Description: to a quote block
    else if (line.startsWith('# Description:')) {
      const description = line.replace('# Description:', '').trim();
      markdown += `> ${description}\n\n`;
    }
    // Handle Details section
    else if (line.startsWith('# Details:')) {
      inDetailsSection = true;
      markdown += `### Implementation Details\n\n`;
    }
    // Handle Test Strategy section
    else if (line.startsWith('# Test Strategy:')) {
      inDetailsSection = false;
      inTestSection = true;
      markdown += `### Test Strategy\n\n`;
    }
    // Handle content in a section
    else if (inDetailsSection || inTestSection) {
      // Skip empty lines at the beginning of sections
      if (line.trim() === '' && 
         ((inDetailsSection && !markdown.includes('Implementation Details')) ||
          (inTestSection && !markdown.includes('Test Strategy')))) {
        continue;
      }
      
      // Add the line to the markdown content
      markdown += `${line}\n`;
      
      // Add an extra newline after a paragraph
      if (line.trim() === '') {
        markdown += '\n';
      }
    }
  }
  
  return markdown;
}

/**
 * Render complexity report as rich text
 * @param {string} content - Raw complexity report content (JSON)
 * @returns {string} - Formatted rich text output
 */
export function renderComplexityReport(content) {
  try {
    // Parse JSON content
    const report = JSON.parse(content);
    
    // Convert to markdown
    let markdown = '# Task Complexity Analysis\n\n';
    
    // Add metadata
    markdown += `**Generated:** ${new Date(report.metadata.generatedAt).toLocaleString()}\n`;
    markdown += `**Task Count:** ${report.metadata.taskCount}\n`;
    markdown += `**Model:** ${report.metadata.model}\n\n`;
    
    // Distribution summary
    markdown += '## Complexity Distribution\n\n';
    
    // Count tasks by complexity level
    const complexityLevels = {
      high: report.complexityAnalysis.filter(t => t.complexityScore >= 8).length,
      medium: report.complexityAnalysis.filter(t => t.complexityScore >= 5 && t.complexityScore < 8).length,
      low: report.complexityAnalysis.filter(t => t.complexityScore < 5).length
    };
    
    markdown += `- **High (8-10):** ${complexityLevels.high} tasks\n`;
    markdown += `- **Medium (5-7):** ${complexityLevels.medium} tasks\n`;
    markdown += `- **Low (1-4):** ${complexityLevels.low} tasks\n\n`;
    
    // Task details
    markdown += '## Task Details\n\n';
    
    report.complexityAnalysis.forEach(task => {
      markdown += `### Task ${task.taskId}: ${task.taskTitle}\n\n`;
      markdown += `**Complexity Score:** ${task.complexityScore}\n`;
      markdown += `**Recommended Subtasks:** ${task.recommendedSubtasks}\n\n`;
      markdown += `**Reasoning:** ${task.reasoning}\n\n`;
      
      // Add optional expansion command if available
      if (task.expansionCommand) {
        markdown += "```bash\n";
        markdown += `${task.expansionCommand}\n`;
        markdown += "```\n\n";
      }
    });
    
    return marked.parse(markdown);
  } catch (error) {
    // If parsing fails, return the original content
    console.error('Error rendering complexity report:', error.message);
    return content;
  }
}

/**
 * Render PRD as rich text
 * @param {string} content - Raw PRD content
 * @returns {string} - Formatted rich text output
 */
export function renderPrd(content) {
  // PRD is already in markdown format, so just parse it
  return marked.parse(content);
}

/**
 * Render JSON content as rich text with syntax highlighting
 * @param {string|object} content - JSON string or object to render
 * @returns {string} - Formatted rich text output with syntax highlighting
 */
export function renderJsonContent(content) {
  try {
    // If content is an object, stringify it with pretty formatting
    const jsonString = typeof content === 'string' 
      ? content 
      : JSON.stringify(content, null, 2);
    
    // Parse the JSON to validate and format it
    const parsedJson = JSON.parse(jsonString);
    
    // Convert to a well-formatted string with 2-space indentation
    const formattedJson = JSON.stringify(parsedJson, null, 2);
    
    // Wrap in a markdown code block with json language specifier for syntax highlighting
    const markdown = "```json\n" + formattedJson + "\n```";
    
    // Use marked to render the markdown with terminal styling
    return marked.parse(markdown);
  } catch (error) {
    // If parsing fails, return the original content
    console.error('Error rendering JSON:', error.message);
    return typeof content === 'string' ? content : JSON.stringify(content);
  }
}

/**
 * Create an interactive collapsible section in the terminal
 * Initially shows just the title, and expands to show content when user interacts
 * 
 * @param {string} title - The title or header for the collapsible section
 * @param {string|Function} content - Content to display (string or function that returns content)
 * @param {Object} options - Additional options for rendering
 * @param {string} options.titleColor - Color for the title (default: 'cyan')
 * @param {string} options.borderColor - Color for the border (default: 'gray')
 * @param {boolean} options.initialExpanded - Whether section should start expanded (default: false)
 * @returns {Object} - Object with methods to control the collapsible
 */
export function renderCollapsibleContent(title, content, options = {}) {
  // Default options
  const defaults = {
    titleColor: 'cyan',
    borderColor: 'gray',
    initialExpanded: false,
    expandSymbol: '▶',
    collapseSymbol: '▼'
  };
  
  // Merge options
  const config = { ...defaults, ...options };
  
  // Create a spinner
  const spinner = ora({
    text: chalk[config.titleColor](`${config.initialExpanded ? config.collapseSymbol : config.expandSymbol} ${title}`),
    color: config.titleColor,
    prefixText: ' ',
    isEnabled: true
  });
  
  // Start the spinner
  spinner.start();
  
  // Initialize state
  let isExpanded = config.initialExpanded;
  
  // If initially expanded, show content
  if (isExpanded) {
    spinner.stop();
    
    // Format content string
    const contentStr = typeof content === 'function' ? content() : content;
    
    // Display in a box
    console.log(boxen(contentStr, {
      padding: 1,
      margin: { top: 0, bottom: 1 },
      borderColor: config.borderColor,
      borderStyle: 'round'
    }));
    
    // Restart spinner with collapsed symbol
    spinner.text = chalk[config.titleColor](`${config.collapseSymbol} ${title}`);
    spinner.start();
  }
  
  // Return object with methods to control the collapsible
  return {
    // Toggle expansion state
    toggle: () => {
      isExpanded = !isExpanded;
      spinner.stop();
      
      if (isExpanded) {
        // Format content string
        const contentStr = typeof content === 'function' ? content() : content;
        
        // Update spinner text with expanded symbol
        spinner.text = chalk[config.titleColor](`${config.collapseSymbol} ${title}`);
        
        // Display content in a box
        console.log(boxen(contentStr, {
          padding: 1,
          margin: { top: 0, bottom: 1 },
          borderColor: config.borderColor,
          borderStyle: 'round'
        }));
      } else {
        // Update spinner text with collapsed symbol
        spinner.text = chalk[config.titleColor](`${config.expandSymbol} ${title}`);
      }
      
      spinner.start();
      return isExpanded;
    },
    
    // Explicitly expand
    expand: () => {
      if (!isExpanded) {
        return this.toggle();
      }
      return isExpanded;
    },
    
    // Explicitly collapse
    collapse: () => {
      if (isExpanded) {
        return this.toggle();
      }
      return isExpanded;
    },
    
    // Get current state
    isExpanded: () => isExpanded,
    
    // Stop and clean up
    stop: () => {
      spinner.stop();
    }
  };
}

/**
 * Render an interactive report with collapsible sections
 * 
 * @param {string} title - Main title of the report
 * @param {Array} sections - Array of section objects with title and content
 * @param {Object} options - Display options
 * @returns {string} - Formatted report output
 */
export function renderInteractiveReport(title, sections, options = {}) {
  // Default options
  const defaults = {
    titleColor: 'cyan',
    borderColor: 'blue',
    borderStyle: 'round',
    sectionColors: ['yellow', 'green', 'magenta', 'red', 'cyan'],
    expandFirst: true
  };
  
  // Merge options
  const config = { ...defaults, ...options };
  
  // Display report title
  console.log('\n');
  console.log(boxen(
    chalk[config.titleColor].bold(title),
    {
      padding: 1,
      margin: { top: 0, bottom: 1 },
      borderColor: config.borderColor,
      borderStyle: config.borderStyle,
      textAlignment: 'center'
    }
  ));
  
  // Create collapsible sections
  const collapsibles = [];
  
  // Process each section
  sections.forEach((section, index) => {
    // Get color for this section (cycle through available colors if needed)
    const colorIndex = index % config.sectionColors.length;
    const sectionColor = config.sectionColors[colorIndex];
    
    // Set first section to be expanded if expandFirst is true
    const initialExpanded = config.expandFirst && index === 0;
    
    // Create and configure collapsible for this section
    const collapsible = renderCollapsibleContent(
      section.title,
      section.content,
      {
        titleColor: sectionColor,
        borderColor: sectionColor,
        initialExpanded: initialExpanded,
        expandSymbol: section.expandSymbol || config.expandSymbol,
        collapseSymbol: section.collapseSymbol || config.collapseSymbol
      }
    );
    
    // Store reference to collapsible
    collapsibles.push(collapsible);
  });
  
  // Add usage instructions
  console.log(chalk.dim('\nTip: Press Ctrl+C to exit, or expand/collapse sections by selecting them.'));
  
  // Return controls for all sections
  return {
    // Expand all sections
    expandAll: () => {
      collapsibles.forEach(collapsible => collapsible.expand());
    },
    
    // Collapse all sections
    collapseAll: () => {
      collapsibles.forEach(collapsible => collapsible.collapse());
    },
    
    // Toggle a specific section by index
    toggle: (index) => {
      if (index >= 0 && index < collapsibles.length) {
        collapsibles[index].toggle();
      }
    },
    
    // Stop and clean up all spinners
    stop: () => {
      collapsibles.forEach(collapsible => collapsible.stop());
    },
    
    // Get array of collapsible sections for direct manipulation
    sections: collapsibles
  };
}

/**
 * Render complexity report as an interactive report with collapsible sections
 * 
 * @param {string} content - Raw complexity report content (JSON)
 * @param {Object} options - Display options
 * @returns {Object} - Formatted interactive report controls
 */
export function renderInteractiveComplexityReport(content, options = {}) {
  try {
    // Parse JSON content
    const report = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
    
    // Prepare sections array for the interactive report
    const sections = [];
    
    // Section 1: Report Summary
    const generatedDate = new Date(report.metadata.generatedAt).toLocaleString();
    const summaryContent = `
${chalk.bold('Report Summary')}

${chalk.dim('Generated:')} ${generatedDate}
${chalk.dim('Task Count:')} ${report.metadata.taskCount}
${chalk.dim('Model:')} ${report.metadata.model}
    `;
    
    sections.push({
      title: 'Report Summary',
      content: summaryContent
    });
    
    // Section 2: Complexity Distribution
    const complexityLevels = {
      high: report.complexityAnalysis.filter(t => t.complexityScore >= 8).length,
      medium: report.complexityAnalysis.filter(t => t.complexityScore >= 5 && t.complexityScore < 8).length,
      low: report.complexityAnalysis.filter(t => t.complexityScore < 5).length
    };
    
    const distributionContent = `
${chalk.bold('Complexity Distribution')}

${chalk.red.bold('High (8-10):')} ${complexityLevels.high} tasks
${chalk.yellow.bold('Medium (5-7):')} ${complexityLevels.medium} tasks
${chalk.green.bold('Low (1-4):')} ${complexityLevels.low} tasks

${chalk.dim('Tasks are organized by complexity to help you focus on breaking down the most complex tasks first.')}
    `;
    
    sections.push({
      title: 'Complexity Distribution',
      content: distributionContent
    });
    
    // Section 3-5: Task Details by Complexity (High, Medium, Low)
    const highComplexityTasks = report.complexityAnalysis.filter(t => t.complexityScore >= 8);
    const mediumComplexityTasks = report.complexityAnalysis.filter(t => t.complexityScore >= 5 && t.complexityScore < 8);
    const lowComplexityTasks = report.complexityAnalysis.filter(t => t.complexityScore < 5);
    
    // Add high complexity tasks section if there are any
    if (highComplexityTasks.length > 0) {
      let highTasksContent = `${chalk.bold.red('High Complexity Tasks')} ${chalk.dim('(Score 8-10)')}\n\n`;
      
      highComplexityTasks.forEach(task => {
        highTasksContent += `${chalk.red.bold(`Task ${task.taskId}:`)} ${task.taskTitle}\n`;
        highTasksContent += `${chalk.dim('Score:')} ${chalk.red(task.complexityScore)}\n`;
        highTasksContent += `${chalk.dim('Recommended Subtasks:')} ${task.recommendedSubtasks}\n\n`;
        highTasksContent += `${chalk.underline('Reasoning:')}\n${task.reasoning}\n\n`;
        
        if (task.expansionCommand) {
          highTasksContent += `${chalk.green('Expansion Command:')}\n${chalk.yellow(task.expansionCommand)}\n\n`;
        }
        
        highTasksContent += chalk.dim('–'.repeat(50)) + '\n\n';
      });
      
      sections.push({
        title: `High Complexity Tasks (${highComplexityTasks.length})`,
        content: highTasksContent,
        expandSymbol: '⚠️',
        collapseSymbol: '⚠️'
      });
    }
    
    // Add medium complexity tasks section if there are any
    if (mediumComplexityTasks.length > 0) {
      let mediumTasksContent = `${chalk.bold.yellow('Medium Complexity Tasks')} ${chalk.dim('(Score 5-7)')}\n\n`;
      
      mediumComplexityTasks.forEach(task => {
        mediumTasksContent += `${chalk.yellow.bold(`Task ${task.taskId}:`)} ${task.taskTitle}\n`;
        mediumTasksContent += `${chalk.dim('Score:')} ${chalk.yellow(task.complexityScore)}\n`;
        mediumTasksContent += `${chalk.dim('Recommended Subtasks:')} ${task.recommendedSubtasks}\n\n`;
        mediumTasksContent += `${chalk.underline('Reasoning:')}\n${task.reasoning}\n\n`;
        
        if (task.expansionCommand) {
          mediumTasksContent += `${chalk.green('Expansion Command:')}\n${chalk.yellow(task.expansionCommand)}\n\n`;
        }
        
        mediumTasksContent += chalk.dim('–'.repeat(50)) + '\n\n';
      });
      
      sections.push({
        title: `Medium Complexity Tasks (${mediumComplexityTasks.length})`,
        content: mediumTasksContent,
        expandSymbol: '⚡',
        collapseSymbol: '⚡'
      });
    }
    
    // Add low complexity tasks section if there are any
    if (lowComplexityTasks.length > 0) {
      let lowTasksContent = `${chalk.bold.green('Low Complexity Tasks')} ${chalk.dim('(Score 1-4)')}\n\n`;
      
      lowComplexityTasks.forEach(task => {
        lowTasksContent += `${chalk.green.bold(`Task ${task.taskId}:`)} ${task.taskTitle}\n`;
        lowTasksContent += `${chalk.dim('Score:')} ${chalk.green(task.complexityScore)}\n`;
        lowTasksContent += `${chalk.dim('Recommended Subtasks:')} ${task.recommendedSubtasks}\n\n`;
        lowTasksContent += `${chalk.underline('Reasoning:')}\n${task.reasoning}\n\n`;
        
        if (task.expansionCommand) {
          lowTasksContent += `${chalk.green('Expansion Command:')}\n${chalk.yellow(task.expansionCommand)}\n\n`;
        }
        
        lowTasksContent += chalk.dim('–'.repeat(50)) + '\n\n';
      });
      
      sections.push({
        title: `Low Complexity Tasks (${lowComplexityTasks.length})`,
        content: lowTasksContent,
        expandSymbol: '✓',
        collapseSymbol: '✓'
      });
    }
    
    // Section 6: Next Steps & Recommendations
    const recommendationsContent = `
${chalk.bold('Recommendations')}

${chalk.cyan('1.')} Focus on breaking down ${chalk.red.bold('high complexity tasks')} first.
${chalk.cyan('2.')} Use the expansion commands provided with each task.
${chalk.cyan('3.')} Consider adding more detailed test strategies for complex tasks.
${chalk.cyan('4.')} Review dependency chains to ensure proper task sequencing.

${chalk.dim('For detailed task breakdown, you can use:')}
${chalk.yellow('task-master expand --id=<taskId> --num=<recommendedSubtasks> --research')}
    `;
    
    sections.push({
      title: 'Recommendations & Next Steps',
      content: recommendationsContent
    });
    
    // Create interactive report
    return renderInteractiveReport('Task Complexity Analysis', sections, options);
    
  } catch (error) {
    // If parsing fails, show error
    console.error(chalk.red('Error rendering interactive complexity report:'), error.message);
    
    // Create a simple error report
    const sections = [{
      title: 'Error Details',
      content: `
${chalk.red.bold('Failed to parse or render complexity report')}

${chalk.dim('Error Message:')} ${error.message}
${chalk.dim('Error Stack:')} ${error.stack}

${chalk.yellow('Please check that the input is valid JSON and try again.')}
      `,
      initialExpanded: true
    }];
    
    return renderInteractiveReport('Complexity Report Error', sections, {
      borderColor: 'red',
      titleColor: 'red'
    });
  }
}

/**
 * Render task list as an interactive report with collapsible task details
 * 
 * @param {Array} tasks - Array of task objects
 * @param {Object} options - Display options
 * @returns {Object} - Formatted interactive report controls
 */
export function renderInteractiveTaskList(tasks, options = {}) {
  try {
    // Default options
    const defaults = {
      titleColor: 'blue',
      showSubtasks: true,
      groupByStatus: false,
      highlightDependencies: true,
      statusColors: {
        'done': 'green',
        'pending': 'yellow',
        'in-progress': 'cyan',
        'blocked': 'red',
        'deferred': 'gray'
      }
    };
    
    // Merge provided options
    const config = { ...defaults, ...options };
    
    // Helper function to format task status with color
    const formatStatus = (status) => {
      const color = config.statusColors[status] || 'white';
      return chalk[color](status);
    };
    
    // Helper function to format dependencies
    const formatDependencies = (dependencies, allTasks) => {
      if (!dependencies || dependencies.length === 0) {
        return chalk.dim('None');
      }
      
      return dependencies.map(depId => {
        const depTask = allTasks.find(t => t.id === depId);
        if (depTask) {
          const isDone = depTask.status === 'done';
          const symbol = isDone ? '✅' : '⏱️';
          const color = isDone ? 'green' : 'yellow';
          return `${symbol} ${chalk[color](depId)}`;
        }
        return chalk.red(`${depId} (not found)`);
      }).join(' ');
    };
    
    // Create summary content for each task
    const createTaskSummary = (task) => {
      let content = '';
      
      // Add title and basic information
      content += `${chalk.bold(task.title)}\n\n`;
      content += `${chalk.dim('ID:')} ${task.id}\n`;
      content += `${chalk.dim('Status:')} ${formatStatus(task.status)}\n`;
      content += `${chalk.dim('Priority:')} ${task.priority || 'medium'}\n`;
      
      if (task.dependencies && task.dependencies.length > 0) {
        content += `${chalk.dim('Dependencies:')} ${formatDependencies(task.dependencies, tasks)}\n`;
      }
      
      // Add description if available
      if (task.description) {
        content += `\n${chalk.dim('Description:')}\n${task.description}\n`;
      }
      
      // Add details preview (truncated)
      if (task.details) {
        const previewLength = 150;
        const detailsPreview = task.details.length > previewLength 
          ? task.details.substring(0, previewLength) + '...' 
          : task.details;
        content += `\n${chalk.dim('Details Preview:')}\n${detailsPreview}\n`;
      }
      
      // Add subtask count if available
      if (task.subtasks && task.subtasks.length > 0) {
        content += `\n${chalk.dim('Subtasks:')} ${task.subtasks.length}\n`;
      }
      
      return content;
    };
    
    // Create detailed content for each task
    const createTaskDetails = (task) => {
      let content = '';
      
      // Add full task details
      content += `${chalk.bold.underline(task.title)} ${chalk.dim(`(ID: ${task.id})`)}\n\n`;
      
      // Add status with color
      content += `${chalk.dim('Status:')} ${formatStatus(task.status)}\n`;
      content += `${chalk.dim('Priority:')} ${task.priority || 'medium'}\n`;
      
      // Add dependencies with status indicators
      if (task.dependencies && task.dependencies.length > 0) {
        content += `${chalk.dim('Dependencies:')} ${formatDependencies(task.dependencies, tasks)}\n`;
      } else {
        content += `${chalk.dim('Dependencies:')} None\n`;
      }
      
      // Add description
      if (task.description) {
        content += `\n${chalk.underline('Description:')}\n${task.description}\n`;
      }
      
      // Add full implementation details
      if (task.details) {
        content += `\n${chalk.underline('Implementation Details:')}\n${task.details}\n`;
      }
      
      // Add test strategy if available
      if (task.testStrategy) {
        content += `\n${chalk.underline('Test Strategy:')}\n${task.testStrategy}\n`;
      }
      
      // Add subtasks if available and enabled
      if (config.showSubtasks && task.subtasks && task.subtasks.length > 0) {
        content += `\n${chalk.underline('Subtasks:')}\n\n`;
        
        task.subtasks.forEach((subtask, i) => {
          const subtaskStatus = subtask.status || 'pending';
          const statusColor = config.statusColors[subtaskStatus] || 'white';
          
          content += `${chalk.bold[statusColor](`${task.id}.${i+1}`)} ${chalk[statusColor](subtask.title)}\n`;
          content += `${chalk.dim('Status:')} ${formatStatus(subtaskStatus)}\n`;
          
          if (subtask.description) {
            content += `${chalk.dim('Description:')} ${subtask.description}\n`;
          }
          
          content += '\n';
        });
      }
      
      // Add commands for working with this task
      content += chalk.dim('–'.repeat(50)) + '\n\n';
      content += `${chalk.bold('Commands:')}\n`;
      content += `${chalk.yellow(`task-master set-status --id=${task.id} --status=done`)}\n`;
      
      if (!task.subtasks || task.subtasks.length === 0) {
        content += `${chalk.yellow(`task-master expand --id=${task.id} --num=3`)}\n`;
      } else {
        content += `${chalk.yellow(`task-master clear-subtasks --id=${task.id}`)}\n`;
      }
      
      return content;
    };
    
    // Group tasks by status if required
    let organizedTasks = [...tasks];
    let sections = [];
    
    if (config.groupByStatus) {
      // Get unique statuses
      const statuses = Array.from(new Set(tasks.map(t => t.status || 'pending')));
      
      // Create a section for each status
      statuses.forEach(status => {
        const statusTasks = tasks.filter(t => (t.status || 'pending') === status);
        if (statusTasks.length > 0) {
          const statusColor = config.statusColors[status] || 'white';
          
          // Create collapsible sections for each task
          const taskSections = statusTasks.map(task => ({
            title: `Task ${task.id}: ${task.title}`,
            content: createTaskDetails(task),
            expandSymbol: '📋',
            collapseSymbol: '📋',
            titleColor: statusColor
          }));
          
          sections.push({
            title: `${status.toUpperCase()} Tasks (${statusTasks.length})`,
            content: taskSections.map((_, i) => `  ${i+1}. ${statusTasks[i].id}: ${statusTasks[i].title}`).join('\n'),
            expandSymbol: '📋',
            collapseSymbol: '📋',
            titleColor: statusColor,
            borderColor: statusColor
          });
        }
      });
    } else {
      // Create a section for each task
      sections = organizedTasks.map(task => {
        const statusColor = config.statusColors[task.status || 'pending'] || 'white';
        return {
          title: `Task ${task.id}: ${task.title}`,
          content: createTaskDetails(task),
          expandSymbol: '📋',
          collapseSymbol: '📋',
          titleColor: statusColor,
          borderColor: statusColor
        };
      });
    }
    
    // Create the interactive report
    return renderInteractiveReport('Task List', sections, {
      titleColor: config.titleColor,
      expandFirst: false
    });
    
  } catch (error) {
    // Handle errors
    console.error(chalk.red('Error rendering interactive task list:'), error.message);
    
    // Create a simple error report
    const sections = [{
      title: 'Error Details',
      content: `
${chalk.red.bold('Failed to render interactive task list')}

${chalk.dim('Error Message:')} ${error.message}
${chalk.dim('Error Stack:')} ${error.stack}
      `,
      initialExpanded: true
    }];
    
    return renderInteractiveReport('Task List Error', sections, {
      borderColor: 'red',
      titleColor: 'red'
    });
  }
} 