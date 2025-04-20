# Markdown Rendering in Task Master

Task Master now includes rich text rendering capabilities for task files, PRD documents, complexity reports, and JSON data in the terminal. This enhances readability and makes the output more visually appealing.

## Implementation Details

The markdown rendering is implemented using the following libraries:

- [marked](https://www.npmjs.com/package/marked): A Markdown parser and compiler.
- [marked-terminal](https://www.npmjs.com/package/marked-terminal): A custom renderer for marked that formats Markdown output for the terminal.
- [ora](https://www.npmjs.com/package/ora): Elegant terminal spinners for interactive elements.
- [boxen](https://www.npmjs.com/package/boxen): Create boxes in the terminal for better visual organization.
- [chalk](https://www.npmjs.com/package/chalk): Terminal string styling with colors and formatting.
- [inquirer](https://www.npmjs.com/package/inquirer): Interactive command line user interfaces.

These libraries allow Task Master to convert task files, PRD content, complexity reports, and JSON data into rich text that can be displayed directly in the terminal with proper formatting, including:

- Headers with different styling levels
- Bold and italic text
- Lists (ordered and unordered)
- Code blocks with syntax highlighting
- Tables with border styling
- Blockquotes
- Horizontal rules
- Interactive collapsible sections
- Color-coded status indicators
- Interactive navigation elements

## Module Structure

The implementation is contained in the `markdown-renderer.js` module, which provides the following functions:

- `renderTaskContent(content)`: Renders task file content as rich text.
- `renderComplexityReport(content)`: Renders the complexity report JSON as rich text.
- `renderPrd(content)`: Renders the PRD document as rich text.
- `renderJsonContent(content)`: Renders JSON data with syntax highlighting.
- `renderCollapsibleContent(title, content, options)`: Creates an interactive collapsible section.
- `renderInteractiveReport(title, sections, options)`: Renders a full interactive report with multiple collapsible sections.
- `renderInteractiveComplexityReport(content, options)`: Renders complexity report as an interactive report with collapsible sections.
- `renderInteractiveTaskList(tasks, options)`: Renders task list as an interactive report with collapsible task details.

## How It Works

1. The `renderTaskContent` function converts task file content (which uses a custom format with `# Field:` syntax) into proper Markdown format.
2. The `renderComplexityReport` function parses the JSON content of the complexity report and generates a markdown representation.
3. The `renderPrd` function directly processes the PRD content, which is already in Markdown format.
4. The `renderJsonContent` function formats JSON data in a pretty-printed format with syntax highlighting.
5. The interactive rendering functions use `ora` for spinners and interactive elements, `boxen` for creating visual containers, and `chalk` for colorized text.
6. All these functions use the `marked` library with the `marked-terminal` renderer to generate terminal-friendly output.

## Interactive Terminal UX Features

The newest additions to Task Master include interactive terminal features that enhance the user experience:

### Collapsible Sections

The `renderCollapsibleContent` function creates expandable/collapsible sections in the terminal output. This helps organize information and allows users to focus on the sections they care about. Key features include:

- Expandable/collapsible sections with visual indicators (▶/▼)
- Color-coded section titles for better categorization
- Customizable symbols and colors
- Interactive toggles via API methods
- Clean spinner-based design that works in most terminals

### Interactive Reports

The `renderInteractiveReport` function creates a complete interactive report with multiple collapsible sections. This provides a modern, app-like experience in the terminal. Features include:

- Attractive title header with customizable styling
- Multiple color-coded sections for different types of information
- Ability to expand/collapse all sections at once
- Clean, organized layout for better readability
- Proper cleanup on exit

### Interactive Complexity Reports

The `renderInteractiveComplexityReport` function enhances the complexity report with interactive features:

- Report summary in collapsible format
- Complexity distribution statistics with color coding (red for high, yellow for medium, green for low)
- Tasks organized by complexity level with intuitive icons (⚠️/⚡/✓)
- Color-coded task listings with detailed information and reasoning
- Contextually relevant expansion commands for each task
- Recommendations and next steps section

### Interactive Task Lists

The `renderInteractiveTaskList` function provides an interactive view of tasks with:

- Color-coded tasks based on status (green for done, yellow for pending, etc.)
- Expandable task details with 📋 icon indicators
- Visual indicators for dependencies and their status (✅/⏱️)
- Optional grouping by status for better organization
- Contextually relevant commands for working with each task
- Subtask listings with status indicators within each task

## Usage Examples

### Rendering Task Content

```javascript
import { renderTaskContent } from './modules/markdown-renderer.js';
import fs from 'fs';

// Read task file content
const taskContent = fs.readFileSync('tasks/task_001.txt', 'utf8');

// Render as rich text
console.log(renderTaskContent(taskContent));
```

### Rendering Complexity Report

```javascript
import { renderComplexityReport } from './modules/markdown-renderer.js';
import fs from 'fs';

// Read complexity report
const reportContent = fs.readFileSync('scripts/task-complexity-report.json', 'utf8');

// Render as rich text
console.log(renderComplexityReport(reportContent));
```

### Interactive Complexity Report

```javascript
import { renderInteractiveComplexityReport } from './modules/markdown-renderer.js';
import fs from 'fs';

// Read complexity report
const reportContent = fs.readFileSync('scripts/task-complexity-report.json', 'utf8');

// Create interactive report with collapsible sections
const report = renderInteractiveComplexityReport(reportContent);

// The report object provides methods to control sections:
// report.expandAll() - Expand all sections
// report.collapseAll() - Collapse all sections
// report.toggle(sectionIndex) - Toggle a specific section
// report.stop() - Clean up when done

// Clean up when done
setTimeout(() => {
  report.stop();
  console.log('Report closed');
}, 60000);
```

### Interactive Task List

```javascript
import { renderInteractiveTaskList } from './modules/markdown-renderer.js';
import fs from 'fs';

// Read tasks.json
const tasksContent = fs.readFileSync('tasks/tasks.json', 'utf8');
const tasksData = JSON.parse(tasksContent);

// Create interactive task list
const taskList = renderInteractiveTaskList(tasksData.tasks, {
  showSubtasks: true,
  groupByStatus: true,
  titleColor: 'cyan'
});

// The taskList object provides methods to control sections
// Use taskList.stop() when done to clean up
```

### Creating Custom Collapsible Sections

```javascript
import { renderCollapsibleContent } from './modules/markdown-renderer.js';
import chalk from 'chalk';

// Create a collapsible section
const section = renderCollapsibleContent(
  'System Information',
  `
${chalk.bold('Platform:')} ${process.platform}
${chalk.bold('Node Version:')} ${process.version}
${chalk.bold('Memory:')} ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
  `,
  {
    titleColor: 'green',
    borderColor: 'green',
    initialExpanded: true
  }
);

// Toggle the section
setTimeout(() => {
  section.toggle();
}, 3000);

// Clean up when done
setTimeout(() => {
  section.stop();
}, 10000);
```

### Rendering PRD

```javascript
import { renderPrd } from './modules/markdown-renderer.js';
import fs from 'fs';

// Read PRD content
const prdContent = fs.readFileSync('prd.txt', 'utf8');

// Render as rich text
console.log(renderPrd(prdContent));
```

### Rendering JSON Data

```javascript
import { renderJsonContent } from './modules/markdown-renderer.js';
import fs from 'fs';

// Method 1: Render JSON from a string
const jsonString = fs.readFileSync('tasks/tasks.json', 'utf8');
console.log(renderJsonContent(jsonString));

// Method 2: Render JSON from an object
const jsonObject = { 
  name: "Task Master", 
  version: "1.0.0",
  features: ["Task Management", "Rich Text Rendering"] 
};
console.log(renderJsonContent(jsonObject));
```

## Customization

The markdown rendering appearance can be customized by modifying the options passed to `marked-terminal` in the `markdown-renderer.js` file. The current configuration includes:

```javascript
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
```

The interactive features can be customized through the options parameters in their respective functions:

```javascript
// Example customizing an interactive report
renderInteractiveReport('Custom Report', sections, {
  titleColor: 'magenta',          // Color of the main title
  borderColor: 'yellow',          // Border color for the title box
  borderStyle: 'double',          // Border style (round, double, etc.)
  sectionColors: ['cyan', 'green'], // Colors to use for sections
  expandFirst: true               // Auto-expand the first section
});

// Example customizing the task list view
renderInteractiveTaskList(tasks, {
  showSubtasks: true,             // Show subtasks within each task
  groupByStatus: true,            // Group tasks by status
  highlightDependencies: true,    // Highlight dependencies with icons
  statusColors: {                 // Custom colors for each status
    'done': 'blue',
    'pending': 'magenta',
    'in-progress': 'green'
  }
});
```

## Terminal Compatibility

The rich text rendering works best in terminals that support ANSI color codes and Unicode characters. Most modern terminal emulators (iTerm2, Windows Terminal, VS Code's integrated terminal, etc.) support these features.

For terminals with limited support, the code includes fallbacks to ensure that the content is still readable even without formatting.

## Future Enhancements

Possible future enhancements to the markdown rendering system:

1. Support for custom themes (dark/light mode)
2. Enhanced code block syntax highlighting for more languages
3. Image placeholders
4. Clickable links in supported terminals
5. Pagination for long output
6. Pretty-printing and highlighting of YAML and other structured formats
7. Integration with terminal-based UI frameworks
8. Interactive task navigation with keyboard shortcuts
9. Progress bar visualizations for task completion
10. Search functionality within interactive reports 