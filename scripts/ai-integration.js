// AI Integration Setup Module
// This module handles the setup of AI tool integrations (Cursor, Roo Code, MCP, etc.)

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { roles, boomerangs, processVariables } from './content-repository.js';

/**
 * Set up AI tool integrations based on user selection
 * @param {Object} options - Configuration options
 * @param {string} options.targetDir - Target directory to create files in
 * @param {string} options.projectName - Project name
 * @param {string} options.projectDescription - Project description
 * @param {Function} options.log - Logging function
 * @param {Function} options.ensureDirectoryExists - Function to create directories
 * @param {Function} options.copyTemplateFile - Function to copy template files
 * @param {string} options.aiTools - Selected AI tools (cursor, roo, all, or none)
 * @param {string} options.mcpIntegration - MCP integration option (mcp-only, files-only, both)
 * @returns {Object} Setup results including which tools were set up
 */
export async function setupAiIntegrations(options) {
  const {
    targetDir,
    projectName,
    projectDescription,
    projectVersion,
    authorName,
    log,
    ensureDirectoryExists,
    copyTemplateFile,
    aiTools = 'all',
    mcpIntegration = 'both'
  } = options;
  
  // Determine which tools to set up
  const setupCursor = ['cursor', 'all'].includes(aiTools);
  const setupRooCode = ['roo', 'all'].includes(aiTools);
  const setupFileBased = ['files-only', 'both'].includes(mcpIntegration);
  const setupMcp = ['mcp-only', 'both'].includes(mcpIntegration);
  
  // Create directories for selected tools
  if (setupCursor) {
    log('info', 'Setting up Cursor AI integration');
    ensureDirectoryExists(path.join(targetDir, '.cursor', 'rules'));
  }
  if (setupRooCode && setupFileBased) {
    log('info', 'Setting up Roo Code file-based integration');
    ensureDirectoryExists(path.join(targetDir, '.roo', 'roles'));
    ensureDirectoryExists(path.join(targetDir, '.roo', 'boomerangs'));
  }
  
  if (setupRooCode && setupMcp) {
    log('info', 'Setting up MCP integration for Roo Code');
    // MCP server setup will be handled separately in the MCP server initialization
  }
  
  
  // Replacements for template files
  const replacements = {
    projectName,
    projectDescription,
    projectVersion,
    authorName,
    year: new Date().getFullYear()
  };
  
  // Set up Cursor AI integration if selected
  if (setupCursor) {
    // Copy cursor-specific files
    copyTemplateFile('dev_workflow.mdc', path.join(targetDir, '.cursor', 'rules', 'dev_workflow.mdc'));
    copyTemplateFile('cursor_rules.mdc', path.join(targetDir, '.cursor', 'rules', 'cursor_rules.mdc'));
    copyTemplateFile('self_improve.mdc', path.join(targetDir, '.cursor', 'rules', 'self_improve.mdc'));
    
    // Copy .windsurfrules
    copyTemplateFile('windsurfrules', path.join(targetDir, '.windsurfrules'));
    
    log('success', 'Cursor AI integration files created');
  }
  
  // Set up Roo Code file-based integration if selected
  if (setupRooCode && setupFileBased) {
    // Create Roo Code files using the content repository
    
    // Create role files
    for (const [roleId, role] of Object.entries(roles)) {
      const rolePath = path.join(targetDir, '.roo', 'roles', `${roleId}.md`);
      // Process variables in content
      const processedContent = processVariables(role.content, role.variables, { projectName });
      fs.writeFileSync(rolePath, processedContent);
      log('info', `Created ${rolePath}`);
    }
    
    // Create boomerang files
    // Create boomerang files
    for (const [boomerangId, boomerang] of Object.entries(boomerangs)) {
      const boomerangPath = path.join(targetDir, '.roo', 'boomerangs', `${boomerangId}.md`);
      // Process variables in content
      const processedContent = processVariables(boomerang.content, boomerang.variables, { projectName });
      fs.writeFileSync(boomerangPath, processedContent);
      log('info', `Created ${boomerangPath}`);
    }
    
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
  let claudeMdContent = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Run/Test Commands
- Build/Install: \`npm install\`
- Run tests: \`npm test\`
- Run single test: \`npm test -- tests/unit/specific-file.test.js\`
- Test with pattern: \`npm test -- -t "pattern to match"\`
- Test with coverage: \`npm run test:coverage\`
- Test in watch mode: \`npm run test:watch\`

## Code Style Guidelines
- **File Structure**: ES modules with \`"type": "module"\` in package.json
- **Imports**: Group by module/functionality, import only what's needed
- **Naming**:
  - kebab-case for CLI command names (\`add-task\`, not \`addTask\`)
  - camelCase for variables, functions, and options in code
- **Error Handling**: Use try/catch with proper error messages, early returns for validation
- **Testing**: Mock first, then import (Jest hoisting); clear mocks in beforeEach
- **Modules**: Maintain clear separation between UI, commands, task-manager, dependency-manager
- **Documentation**: Include JSDoc comments for functions with @param and @returns tags
`;

  // Add appropriate integration section based on setup
  if (setupRooCode && setupFileBased) {
    claudeMdContent += `
## Roo Code Integration
Roo Code resources are available in the \`.roo\` directory:

- **Roles**: \`.roo/roles/*.md\` - Expertise areas for different parts of the codebase
- **Boomerangs**: \`.roo/boomerangs/*.md\` - Templates for implementing specific functionality

When working on this codebase, please reference these resources for guidance on architecture, patterns, and best practices.`;
  }

  if (setupRooCode && setupMcp) {
    claudeMdContent += `
## MCP Integration
Task Master provides resources and tools through the Model Context Protocol (MCP):

- **Resources**: Access roles and boomerangs via URIs like \`role://architecture\` or \`boomerang://expand-task\`
- **Resource Templates**: Use parameterized resources like \`role://architecture/my-project\`
- **Tools**: Access task management operations via standardized MCP tools

AI assistants that support MCP can access these resources programmatically.`;
  }

  fs.writeFileSync(claudeMdPath, claudeMdContent);
  log('success', 'CLAUDE.md created with appropriate integration guidance');
}
  
  // Generate AI tools description based on what was set up
  let aiToolsDescription = '';
  if (setupCursor && setupRooCode) {
    aiToolsDescription = setupMcp ? 'Use Cursor or MCP-enabled AI assistants' : 'Use Cursor or Roo Code';
  } else if (setupCursor) {
    aiToolsDescription = 'Use Cursor';
  } else if (setupRooCode) {
    aiToolsDescription = setupMcp ? 'Use MCP-enabled AI assistants' : 'Use Claude Code (via Roo Code)';
  } else {
    aiToolsDescription = 'Use your preferred AI coding assistant';
  }
  
  return {
    setupCursor,
    setupRooCode,
    setupMcp,
    setupFileBased,
    aiToolsDescription
  };
}

/**
 * Prompts the user to select which AI tools to integrate
 * @param {Object} rl - Readline interface for user input
 * @param {Function} promptQuestion - Function to prompt for user input
 * @returns {string} Selected tools option (cursor, roo, all, or none)
 */
export async function promptForAiTools(rl, promptQuestion) {
  console.log(boxen(
    chalk.cyan.bold('Select AI tool integrations:') + '\n' +
    chalk.white('1. ') + chalk.yellow('Cursor AI') + chalk.dim(' (.cursor directory with rules)') + '\n' +
    chalk.white('2. ') + chalk.yellow('Roo Code') + chalk.dim(' (.roo directory with roles and boomerangs)') + '\n' +
    chalk.white('3. ') + chalk.yellow('All') + chalk.dim(' (both Cursor AI and Roo Code)') + '\n' +
    chalk.white('4. ') + chalk.yellow('None') + chalk.dim(' (no specific AI tool integrations)'),
    {
      padding: 1,
      margin: 0.5,
      borderStyle: 'round',
      borderColor: 'blue',
      title: 'AI Tool Selection',
      titleAlignment: 'center'
    }
  ));
  
  const toolChoice = await promptQuestion(chalk.cyan('Enter your choice (1-4, default: 3): '));
  
  // Parse the user's choice
  const choice = toolChoice.trim() || '3';
  switch(choice) {
    case '1':
      return 'cursor';
    case '2':
      return 'roo';
    case '3':
      return 'all';
    case '4':
      return 'none';
    default:
      return 'all'; // Default to 'all' for any invalid input
  }
}

/**
 * Prompts the user to select MCP integration option
 * @param {Object} rl - Readline interface for user input
 * @param {Function} promptQuestion - Function to prompt for user input
 * @returns {string} Selected MCP integration option (mcp-only, files-only, both)
 */
export async function promptForMcpIntegration(rl, promptQuestion) {
  console.log(boxen(
    chalk.cyan.bold('Select MCP integration:') + '\n' +
    chalk.white('1. ') + chalk.yellow('Use MCP') + chalk.dim(' (Resources packaged in MCP server)') + '\n' +
    chalk.white('2. ') + chalk.yellow('Traditional files') + chalk.dim(' (Create .roo directory with files)') + '\n' +
    chalk.white('3. ') + chalk.yellow('Both') + chalk.dim(' (Support both methods)'),
    {
      padding: 1,
      margin: 0.5,
      borderStyle: 'round',
      borderColor: 'blue',
      title: 'MCP Integration',
      titleAlignment: 'center'
    }
  ));
  
  const mcpChoice = await promptQuestion(chalk.cyan('Enter your choice (1-3, default: 3): '));
  
  // Parse the user's choice
  const choice = mcpChoice.trim() || '3';
  switch(choice) {
    case '1':
      return 'mcp-only';
    case '2':
      return 'files-only';
    case '3':
      return 'both';
    default:
      return 'both'; // Default to 'both' for any invalid input
  }
}

/**
 * Customize the startup message based on AI tool integration
 * @param {string} aiToolsDescription - Description of the AI tools set up
 * @returns {string} Customized startup message
 */
export function getAiToolStartupMessage(aiToolsDescription) {
  return chalk.cyan.bold('Things you can now do:') + '\n\n' +
    chalk.white('1. ') + chalk.yellow('Rename .env.example to .env and add your ANTHROPIC_API_KEY and PERPLEXITY_API_KEY') + '\n' +
    chalk.white('2. ') + chalk.yellow('Discuss your idea with AI, and once ready ask for a PRD using the example_prd.txt file, and save what you get to scripts/PRD.txt') + '\n' +
    chalk.white('3. ') + chalk.yellow(`${aiToolsDescription} to parse your PRD.txt and generate tasks`) + '\n' +
    chalk.white('   └─ ') + chalk.dim('You can also run ') + chalk.cyan('task-master parse-prd <your-prd-file.txt>') + '\n' +
    chalk.white('4. ') + chalk.yellow(`${aiToolsDescription} to analyze the complexity of your tasks`) + '\n' +
    chalk.white('5. ') + chalk.yellow(`${aiToolsDescription} to determine which task to start with`) + '\n' +
    chalk.white('6. ') + chalk.yellow(`${aiToolsDescription} to expand any complex tasks that are too large or complex`) + '\n' +
    chalk.white('7. ') + chalk.yellow(`${aiToolsDescription} to set the status of tasks as you complete them`) + '\n' +
    chalk.white('8. ') + chalk.yellow(`${aiToolsDescription} to update tasks based on new learnings or project changes`) + '\n' +
    chalk.white('9. ') + chalk.green.bold('Ship it!') + '\n\n' +
    chalk.dim('* Review the README.md file to learn how to use other commands with AI assistance.');
}