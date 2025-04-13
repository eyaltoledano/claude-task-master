/**
 * Task Master UI Module
 * Contains user interface related helper functions.
 */

import boxen from 'boxen';
import chalk from 'chalk';
import cliTable3 from 'cli-table3';
import figlet from 'figlet';
import gradient from 'gradient-string';
import fs from 'fs';
import path from 'path';

const Table = cliTable3;

// Create cool gradients for styling
const coolGradient = gradient(['#00b4d8', '#0077b6', '#023e8a']);
const warmGradient = gradient(['#fb8b24', '#e36414', '#9a031e']);

// Banner display function (extracted from dev.js)
export function displayBanner() {
  console.clear();
  const bannerText = figlet.textSync('Task Master AI', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  
  console.log(coolGradient(bannerText));
  
  // Add creator credit line below the banner
  console.log(chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano'));
  
  // Read version directly from package.json
  let version = "1.5.0"; // Default fallback
  try {
    const packageJsonPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      version = packageJson.version;
    }
  } catch (error) {
    // Silently fall back to default version
  }
  
  // Define CONFIG with reasonable defaults if not available
  const CONFIG = { 
    projectName: process.env.PROJECT_NAME || "current project"
  };
  
  console.log(boxen(chalk.white(`${chalk.bold('Version:')} ${version}   ${chalk.bold('Project:')} ${CONFIG.projectName}`), {
    padding: 1,
    margin: { top: 0, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'cyan'
  }));
}

// Help display function (extracted from dev.js)
export function displayHelp() {
  displayBanner();
  
  console.log(boxen(
    chalk.white.bold('Task Master CLI'),
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));
  
  // Command categories
  const commandCategories = [
    {
      title: 'Task Generation',
      color: 'cyan',
      commands: [
        { name: 'parse-prd', args: '--input=<file.txt> [--tasks=10]', 
          desc: 'Generate tasks from a PRD document' },
        { name: 'generate', args: '', 
          desc: 'Create individual task files from tasks.json' },
        { name: 'scan', args: '[--output=file.json] [--directory=.] [--format=json|prd|both]',
          desc: 'Intelligently analyze codebase to generate project structure summary' }
      ]
    },
    {
      title: 'Task Management',
      color: 'green',
      commands: [
        { name: 'list', args: '[--status=<status>] [--with-subtasks]', 
          desc: 'List all tasks with their status' },
        { name: 'set-status', args: '--id=<id> --status=<status>', 
          desc: 'Update task status (done, pending, etc.)' },
        { name: 'update', args: '--from=<id> --prompt="<context>"', 
          desc: 'Update tasks based on new requirements' },
        { name: 'add-dependency', args: '--id=<id> --depends-on=<id>', 
          desc: 'Add a dependency to a task' },
        { name: 'remove-dependency', args: '--id=<id> --depends-on=<id>', 
          desc: 'Remove a dependency from a task' }
      ]
    },
    {
      title: 'Task Analysis & Detail',
      color: 'yellow',
      commands: [
        { name: 'analyze-complexity', args: '[--research] [--threshold=5]', 
          desc: 'Analyze tasks and generate expansion recommendations' },
        { name: 'complexity-report', args: '[--file=<path>]',
          desc: 'Display the complexity analysis report' },
        { name: 'expand', args: '--id=<id> [--num=5] [--research] [--prompt="<context>"]', 
          desc: 'Break down tasks into detailed subtasks' },
        { name: 'expand --all', args: '[--force] [--research]', 
          desc: 'Expand all pending tasks with subtasks' },
        { name: 'clear-subtasks', args: '--id=<id>', 
          desc: 'Remove subtasks from specified tasks' }
      ]
    }
  ];
  
  // Display each category
  commandCategories.forEach(category => {
    console.log(boxen(
      chalk[category.color].bold(category.title),
      { 
        padding: { left: 2, right: 2, top: 0, bottom: 0 }, 
        margin: { top: 1, bottom: 0 }, 
        borderColor: category.color, 
        borderStyle: 'round' 
      }
    ));
    
    const commandTable = new Table({
      colWidths: [25, 40, 45],
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': ' '
      },
      style: { border: [], 'padding-left': 4 }
    });
    
    category.commands.forEach(cmd => {
      commandTable.push([
        chalk.bold(cmd.name),
        chalk.blue(cmd.args),
        cmd.desc
      ]);
    });
    
    console.log(commandTable.toString());
  });
  
  // Environment variables section
  console.log(boxen(
    chalk.magenta.bold('Environment Variables'),
    { 
      padding: { left: 2, right: 2, top: 0, bottom: 0 }, 
      margin: { top: 1, bottom: 0 }, 
      borderColor: 'magenta', 
      borderStyle: 'round' 
    }
  ));
  
  const envTable = new Table({
    colWidths: [25, 20, 65],
    chars: {
      'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
      'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
      'right': '', 'right-mid': '', 'middle': ' '
    },
    style: { border: [], 'padding-left': 4 }
  });
  
  // Import the MODEL and CONFIG variables used in dev.js to display default values
  const MODEL = process.env.MODEL || "claude-3-opus-20240229";
  const CONFIG = { projectName: process.env.PROJECT_NAME || "current project" };
  
  envTable.push(
    [chalk.bold('ANTHROPIC_API_KEY'), chalk.red('Required'), 'Your Anthropic API key for Claude'],
    [chalk.bold('MODEL'), chalk.gray('Optional'), `Claude model to use (default: ${MODEL})`],
    [chalk.bold('PERPLEXITY_API_KEY'), chalk.gray('Optional'), 'API key for research-backed features'],
    [chalk.bold('PROJECT_NAME'), chalk.gray('Optional'), `Project name in metadata (default: ${CONFIG.projectName})`]
  );
  
  console.log(envTable.toString());
  
  // Example usage section
  console.log(boxen(
    chalk.white.bold('Example Workflow'),
    { 
      padding: 1, 
      margin: { top: 1, bottom: 1 }, 
      borderColor: 'white', 
      borderStyle: 'round' 
    }
  ));
  
  console.log(chalk.cyan('  1. Scan your codebase:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js scan --format=both')}`);
  console.log(chalk.cyan('  2. Generate tasks from generated PRD:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js parse-prd --input=scripts/generated_prd.txt')}`);
  console.log(chalk.cyan('  3. Generate task files:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js generate')}`);
  console.log(chalk.cyan('  4. Analyze task complexity:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js analyze-complexity --research')}`);
  console.log(chalk.cyan('  5. Break down complex tasks:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js expand --id=3 --research')}`);
  console.log(chalk.cyan('  6. Track progress:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js list --with-subtasks')}`);
  console.log(chalk.cyan('  7. Update task status:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js set-status --id=1 --status=done')}`);
  
  console.log('\n');
}
