#!/usr/bin/env node

/**
 * continue-scan.js
 * 
 * This script continues the workspace scanner process, collecting and displaying all
 * generated documents after the initial task generation.
 */

import path from 'path';
import fs from 'fs';
import { analyzeTaskComplexity } from './modules/task-manager.js';
import chalk from 'chalk';
import readline from 'readline';
import { renderTaskContent, renderComplexityReport, renderPrd, renderJsonContent } from './modules/markdown-renderer.js';

console.log(chalk.bgGreen.black('DEBUG: continue-scan.js script starting...'));

/**
 * Simple interactive menu system to display documents with rollup/dropdown capability
 * @param {Object} documents - Collection of documents to display
 * @returns {Promise<void>}
 */
async function displayInteractiveDocuments(documents) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Helper function to display the main menu
  function showMenu() {
    console.clear();
    console.log(chalk.cyan.bold('\n===== GENERATED DOCUMENTS =====\n'));
    
    const options = [];
    
    // Add PRD option if it exists
    if (documents.prd) {
      options.push({ id: 1, name: 'PRD', display: () => renderPrd(documents.prd) });
      console.log(chalk.yellow(`1. PRD`));
    }
    
    // Add tasks.json option
    options.push({ id: options.length + 1, name: 'TASKS.JSON', display: () => renderJsonContent(documents.tasksJson) });
    console.log(chalk.cyan(`${options.length}. TASKS.JSON`));
    
    // Add complexity report if it exists
    if (documents.complexityReport) {
      options.push({ id: options.length + 1, name: 'COMPLEXITY REPORT', display: () => renderComplexityReport(documents.complexityReport) });
      console.log(chalk.magenta(`${options.length}. COMPLEXITY REPORT`));
    }
    
    // Group task files by first digit
    const taskGroups = {};
    
    Object.entries(documents.taskFiles || {}).forEach(([taskId, content]) => {
      const firstDigit = taskId.charAt(0);
      if (!taskGroups[firstDigit]) {
        taskGroups[firstDigit] = [];
      }
      taskGroups[firstDigit].push({ taskId, content });
    });
    
    // Add task group options
    Object.entries(taskGroups).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).forEach(([groupId, tasks]) => {
      options.push({ 
        id: options.length + 1, 
        name: `TASKS ${groupId}x`, 
        display: () => {
          let output = '';
          tasks.sort((a, b) => a.taskId.localeCompare(b.taskId, undefined, { numeric: true })).forEach(({ taskId, content }) => {
            output += chalk.cyan(`\n--- TASK ${taskId} ---\n\n`);
            output += renderTaskContent(content);
            output += '\n' + chalk.dim('─'.repeat(50)) + '\n';
          });
          return output;
        }
      });
      console.log(chalk.green(`${options.length}. TASKS ${groupId}x`));
    });
    
    // Add exit option
    console.log(chalk.red(`0. Exit document viewer`));
    console.log(chalk.dim('\nEnter a number to view a document. Press 0 to exit.'));
    
    return options;
  }
  
  // Helper function to display a document
  function displayDocument(doc) {
    console.clear();
    console.log(chalk.cyan.bold(`\n===== ${doc.name} =====\n`));
    console.log(doc.display());
    console.log(chalk.dim('\nPress Enter to return to the menu...'));
  }
  
  let exit = false;
  while (!exit) {
    const options = showMenu();
    
    const answer = await new Promise(resolve => {
      rl.question('> ', resolve);
    });
    
    const selection = parseInt(answer.trim());
    
    if (selection === 0) {
      exit = true;
    } else if (selection > 0 && selection <= options.length) {
      const selectedDoc = options[selection - 1];
      displayDocument(selectedDoc);
      await new Promise(resolve => {
        rl.question('', resolve);
      });
    } else {
      console.log(chalk.red('Invalid selection. Please try again.'));
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  rl.close();
  console.log(chalk.green('\nDocument viewer closed.'));
}

/**
 * Main function that continues the workspace scanner process
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipComplexity - Skip the complexity analysis step
 * @param {boolean} options.force - Force overwrite existing files
 * @param {boolean} options.cliMode - Use CLI-friendly output
 * @param {string} options.directory - Directory to use as the project root
 * @param {boolean} options.displayAll - Display all generated files
 * @returns {Promise<Object>} - Result of the operation
 */
export async function continueScan(options = {}) {
  // Default options
  const defaultOptions = {
    skipComplexity: false,
    force: false,
    cliMode: true,
    directory: process.cwd(),
    displayAll: true
  };
  
  // Merge provided options with defaults
  const config = { ...defaultOptions, ...options };
  
  console.log(chalk.bgCyan.black('DEBUG: continueScan function called with options:'), config);
  
  try {
    if (config.cliMode) {
      console.log(chalk.cyan('=== Continuing Workspace Scan ==='));
    }
    
    // Verify tasks.json exists
    const tasksPath = path.join(config.directory, 'tasks', 'tasks.json');
    console.log(chalk.bgYellow.black(`DEBUG: Looking for tasks.json at ${tasksPath}`));
    
    if (!fs.existsSync(tasksPath)) {
      const errorMsg = 'Error: tasks.json not found. Please run workspace scan first.';
      if (config.cliMode) {
        console.error(chalk.red(errorMsg));
      }
      return { success: false, error: errorMsg };
    }
    
    // Read task data
    const taskData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    const tasks = taskData.tasks || [];
    if (config.cliMode) {
      console.log(chalk.green(`Found ${tasks.length} existing tasks`));
    }
    
    // Define complexityReportPath here so it's available for the whole function
    const complexityReportPath = path.join(config.directory, 'scripts', 'task-complexity-report.json');
    
    // Run task complexity analysis if not skipped
    if (!config.skipComplexity) {
      // Check if complexity report already exists and has content
      let complexityReportExists = false;
      try {
        if (fs.existsSync(complexityReportPath)) {
          const stats = fs.statSync(complexityReportPath);
          complexityReportExists = stats.size > 0;
        }
      } catch (err) {
        // If there's an error checking the file, assume it doesn't exist or is invalid
        complexityReportExists = false;
      }
      
      if (complexityReportExists) {
        if (config.cliMode) {
          console.log(chalk.yellow('Skipping task complexity analysis - report already exists'));
        }
      } else {
        if (config.cliMode) {
          console.log(chalk.yellow('Running task complexity analysis...'));
        }
        
        await analyzeTaskComplexity(tasks, {
          research: false,
          tasksJsonPath: tasksPath,
          reportPath: complexityReportPath
        });
        
        if (config.cliMode) {
          console.log(chalk.green('Task complexity analysis complete'));
        }
      }
    }
    
    // Collect all generated documents
    const generatedFiles = {};
    
    // Read and collect PRD if it exists
    const prdPath = path.join(config.directory, 'scripts', 'prd.txt');
    if (fs.existsSync(prdPath)) {
      generatedFiles.prd = fs.readFileSync(prdPath, 'utf8');
    }
    
    // Read and collect tasks.json
    generatedFiles.tasksJson = fs.readFileSync(tasksPath, 'utf8');
    
    // Read and collect complexity report if exists
    if (fs.existsSync(complexityReportPath)) {
      generatedFiles.complexityReport = fs.readFileSync(complexityReportPath, 'utf8');
    }
    
    // Read and collect all task files
    const tasksDir = path.join(config.directory, 'tasks');
    const taskFiles = fs.readdirSync(tasksDir)
      .filter(file => file.startsWith('task_') && file.endsWith('.txt'))
      .sort((a, b) => {
        const idA = parseInt(a.replace('task_', '').replace('.txt', ''), 10);
        const idB = parseInt(b.replace('task_', '').replace('.txt', ''), 10);
        return idA - idB;
      });
    
    generatedFiles.taskFiles = {};
    for (const file of taskFiles) {
      const taskId = file.replace('task_', '').replace('.txt', '');
      generatedFiles.taskFiles[taskId] = fs.readFileSync(path.join(tasksDir, file), 'utf8');
    }
    
    // Display all generated documents if requested
    if (config.displayAll && config.cliMode) {
      console.log(chalk.cyan('\nStarting interactive document viewer...'));
      
      try {
        // Launch the interactive document viewer
        await displayInteractiveDocuments(generatedFiles);
      } catch (viewerError) {
        console.error(chalk.red(`Error in document viewer: ${viewerError.message}`));
        console.error(chalk.yellow('Continuing with the workflow...'));
      }
    }
    
    if (config.cliMode) {
      console.log(chalk.green('\n=== Workspace Scan Process Complete ==='));
      console.log(chalk.cyan('You can now start working on the generated tasks:'));
      console.log(chalk.yellow('  - View tasks: npx task-master list'));
      console.log(chalk.yellow('  - Next task: npx task-master next'));
      console.log(chalk.yellow('  - Expand tasks: npx task-master expand --id=<id>'));
    }
    
    return {
      success: true,
      generatedFiles,
      message: 'Workspace scan continuation completed successfully!'
    };
    
  } catch (error) {
    if (config.cliMode) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (process.env.DEBUG === '1') {
        console.error(error.stack);
      }
    }
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// If script is run directly (not imported), execute the function
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(chalk.bgMagenta.black('DEBUG: Running continue-scan.js directly'));
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    skipComplexity: args.includes('--skip-complexity'),
    force: args.includes('--force'),
    cliMode: true,
    directory: process.cwd(),
    displayAll: !args.includes('--no-display')
  };
  
  console.log(chalk.bgGreen.black('DEBUG: Parsed command line options:'), options);
  
  continueScan(options)
    .then(result => {
      console.log(chalk.bgBlue.white('DEBUG: continueScan completed with result:'), result.success ? 'SUCCESS' : 'FAILURE');
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(chalk.red(`Unhandled error: ${error.message}`));
      console.error(chalk.red(error.stack));
      process.exit(1);
    });
} else {
  console.log(chalk.bgRed.white('DEBUG: continue-scan.js imported as a module'));
}

export default continueScan; 