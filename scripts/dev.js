#!/usr/bin/env node

/**
 * dev.js
 *
 * Subcommands:
 *   1) parse-prd --input=some-prd.txt [--tasks=10]
 *      -> Creates/overwrites tasks.json with a set of tasks (naive or LLM-based).
 *      -> Optional --tasks parameter limits the number of tasks generated.
 *
 *   2) update --from=5 --prompt="We changed from Slack to Discord."
 *      -> Regenerates tasks from ID >= 5 using the provided prompt.
 *      -> Only updates tasks that aren't marked as 'done'.
 *      -> The --prompt parameter is required and should explain the changes or new context.
 *
 *   3) generate
 *      -> Generates per-task files (e.g., task_001.txt) from tasks.json
 *
 *   4) set-status --id=4 --status=done
 *      -> Updates a single task's status to done (or pending, deferred, in-progress, etc.).
 *      -> Supports comma-separated IDs for updating multiple tasks: --id=1,2,3,1.1,1.2
 *      -> If you set the status of a parent task to done, all its subtasks will be set to done.
 *   5) list
 *      -> Lists tasks in a brief console view (ID, title, status).
 *
 *   6) expand --id=3 [--num=5] [--no-research] [--prompt="Additional context"]
 *      -> Expands a task with subtasks for more detailed implementation.
 *      -> Use --all instead of --id to expand all tasks.
 *      -> Optional --num parameter controls number of subtasks (default: 3).
 *      -> Uses Perplexity AI for research-backed subtask generation by default.
 *      -> Use --no-research to disable research-backed generation.
 *      -> Add --force when using --all to regenerate subtasks for tasks that already have them.
 *      -> Note: Tasks marked as 'done' or 'completed' are always skipped.
 *      -> If a complexity report exists for the specified task, its recommended 
 *         subtask count and expansion prompt will be used (unless overridden).
 *
 *   7) analyze-complexity [options]
 *      -> Analyzes task complexity and generates expansion recommendations
 *      -> Generates a report in scripts/task-complexity-report.json by default 
 *      -> Uses configured LLM to assess task complexity and create tailored expansion prompts
 *      -> Can use Perplexity AI for research-backed analysis with --research flag
 *      -> Each task includes:
 *         - Complexity score (1-10)
 *         - Recommended number of subtasks (based on DEFAULT_SUBTASKS config)
 *         - Detailed expansion prompt
 *         - Reasoning for complexity assessment
 *         - Ready-to-run expansion command
 *      -> Options:
 *         --output, -o <file>: Specify output file path (default: 'scripts/task-complexity-report.json')
 *         --model, -m <model>: Override LLM model to use for analysis
 *         --threshold, -t <number>: Set minimum complexity score (1-10) for expansion recommendation (default: 5)
 *         --file, -f <path>: Use alternative tasks.json file instead of default
 *         --research, -r: Use Perplexity AI for research-backed complexity analysis
 *
 *   8) clear-subtasks
 *      -> Clears subtasks from specified tasks
 *      -> Supports comma-separated IDs for clearing multiple tasks: --id=1,2,3,1.1,1.2
 *      -> Use --all to clear subtasks from all tasks
 *   
 *   9) next
 *      -> Shows the next task to work on based on dependencies and status
 *      -> Prioritizes tasks whose dependencies are all satisfied
 *      -> Orders eligible tasks by priority, dependency count, and ID
 *      -> Displays comprehensive information about the selected task
 *      -> Shows subtasks if they exist
 *      -> Provides contextual action commands for the next steps
 *
 *   10) show [id] or show --id=<id>
 *      -> Shows details of a specific task by ID
 *      -> Displays the same comprehensive information as the 'next' command
 *      -> Handles both regular tasks and subtasks (e.g., 1.2)
 *      -> For subtasks, shows parent task information and link
 *      -> Provides contextual action commands tailored to the specific task
 *
 *   11) add-dependency --id=<id> --depends-on=<id>
 *      -> Adds a dependency to a task
 *      -> Checks if the dependency already exists before adding
 *      -> Prevents circular dependencies
 *      -> Automatically sorts dependencies for clarity
 *
 *   12) remove-dependency --id=<id> --depends-on=<id>
 *      -> Removes a dependency from a task
 *      -> Checks if the dependency exists before attempting to remove
 * 
 *   13) validate-dependencies
 *      -> Checks for and identifies invalid dependencies in tasks.json and task files
 *      -> Reports all non-existent dependencies and self-dependencies
 *      -> Provides detailed statistics on task dependencies
 *      -> Does not automatically fix issues, only identifies them
 *
 *   14) fix-dependencies
 *      -> Finds and fixes all invalid dependencies in tasks.json and task files
 *      -> Removes references to non-existent tasks and subtasks
 *      -> Eliminates self-dependencies
 *      -> Regenerates task files with corrected dependencies
 *      -> Provides detailed report of all fixes made
 *
 *   15) complexity-report [--file=path]
 *      -> Displays the task complexity analysis report in a readable format
 *      -> Shows tasks organized by complexity score with recommended actions
 *      -> Includes complexity distribution statistics
 *      -> Provides ready-to-use expansion commands
 *      -> If no report exists, offers to generate one
 *      -> Options:
 *         --file, -f <path>: Specify report file path (default: 'scripts/task-complexity-report.json')
 *
 * Usage examples:
 *   node dev.js parse-prd --input=sample-prd.txt
 *   node dev.js parse-prd --input=sample-prd.txt --tasks=10
 *   node dev.js update --from=4 --prompt="Refactor tasks from ID 4 onward"
 *   node dev.js generate
 *   node dev.js set-status --id=3 --status=done
 *   node dev.js list
 *   node dev.js expand --id=3 --num=5
 *   node dev.js expand --id=3 --no-research
 *   node dev.js expand --all
 *   node dev.js expand --all --force
 *   node dev.js analyze-complexity
 *   node dev.js analyze-complexity --output=custom-report.json
 *   node dev.js analyze-complexity --threshold=6 --model=claude-3.7-sonnet
 *   node dev.js analyze-complexity --research
 *   node dev.js clear-subtasks --id=1,2,3 --all
 *   node dev.js next
 *   node dev.js show 1
 *   node dev.js show --id=1.2
 *   node dev.js add-dependency --id=22 --depends-on=21
 *   node dev.js remove-dependency --id=22 --depends-on=21
 *   node dev.js validate-dependencies
 *   node dev.js fix-dependencies
 *   node dev.js complexity-report
 *   node dev.js complexity-report --file=custom-report.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';
import { program } from 'commander';
import chalk from 'chalk';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import figlet from 'figlet';
import boxen from 'boxen';
import ora from 'ora';
import Table from 'cli-table3';
import gradient from 'gradient-string';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Configure Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configure OpenAI client for Perplexity - make it lazy
let perplexity = null;
function getPerplexityClient() {
  if (!perplexity) {
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY environment variable is missing. Set it to use research-backed features.");
    }
    perplexity = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    });
  }
  return perplexity;
}

// Model configuration
const MODEL = process.env.MODEL || 'claude-3-7-sonnet-20250219';
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || 'sonar-small-online';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '4000');
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.7');

// Set up configuration with environment variables or defaults
const CONFIG = {
  model: MODEL,
  maxTokens: MAX_TOKENS,
  temperature: TEMPERATURE,
  debug: process.env.DEBUG === "true",
  logLevel: process.env.LOG_LEVEL || "info",
  defaultSubtasks: parseInt(process.env.DEFAULT_SUBTASKS || "3"),
  defaultPriority: process.env.DEFAULT_PRIORITY || "medium",
  projectName: process.env.PROJECT_NAME || "Task Master",
  projectVersion: "1.5.0" // Hardcoded version - ALWAYS use this value, ignore environment variable
};

// Set up logging based on log level
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Create a color gradient for the banner
const coolGradient = gradient(['#00b4d8', '#0077b6', '#03045e']);
const warmGradient = gradient(['#fb8b24', '#e36414', '#9a031e']);

// Display a fancy banner
function displayBanner() {
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
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      version = packageJson.version;
    }
  } catch (error) {
    // Silently fall back to default version
  }
  
  console.log(boxen(chalk.white(`${chalk.bold('Version:')} ${version}   ${chalk.bold('Project:')} ${CONFIG.projectName}`), {
    padding: 1,
    margin: { top: 0, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'cyan'
  }));
}

function log(level, ...args) {
  const icons = {
    debug: chalk.gray('🔍'),
    info: chalk.blue('ℹ️'),
    warn: chalk.yellow('⚠️'),
    error: chalk.red('❌'),
    success: chalk.green('✅')
  };
  
  if (LOG_LEVELS[level] >= LOG_LEVELS[CONFIG.logLevel]) {
    const icon = icons[level] || '';
    
    if (level === 'error') {
      console.error(icon, chalk.red(...args));
    } else if (level === 'warn') {
      console.warn(icon, chalk.yellow(...args));
    } else if (level === 'success') {
      console.log(icon, chalk.green(...args));
    } else if (level === 'info') {
      console.log(icon, chalk.blue(...args));
    } else {
      console.log(icon, ...args);
    }
  }
  
  // Additional debug logging to file if debug mode is enabled
  if (CONFIG.debug && level === 'debug') {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [DEBUG] ${args.join(' ')}\n`;
    fs.appendFileSync('dev-debug.log', logMessage);
  }
}

function readJSON(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const data = JSON.parse(content);
    
    // Optional validation and cleanup of task dependencies
    if (data && data.tasks && Array.isArray(data.tasks)) {
      validateTaskDependencies(data.tasks, filepath);
    }
    
    return data;
  } catch (error) {
    log('error', `Error reading JSON file: ${filepath}`, error);
    return null;
  }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// Replace the simple loading indicator with ora spinner
function startLoadingIndicator(message) {
  const spinner = ora({
    text: message,
    color: 'cyan',
    spinner: 'dots'
  }).start();
  
  return spinner;
}

function stopLoadingIndicator(spinner) {
  if (spinner && spinner.stop) {
    spinner.stop();
  }
}

async function callClaude(prdContent, prdPath, numTasks, retryCount = 0) {
  const MAX_RETRIES = 3;
  const INITIAL_BACKOFF_MS = 1000;
  
  log('info', `Starting Claude API call to process PRD from ${prdPath}...`);
  log('debug', `PRD content length: ${prdContent.length} characters`);
  
  // Start loading indicator
  const loadingMessage = `Waiting for Claude to generate tasks${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}...`;
  const loadingIndicator = startLoadingIndicator(loadingMessage);
  
  const TASKS_JSON_TEMPLATE = `
  {
    "meta": {
      "projectName": "${CONFIG.projectName}",
      "version": "${CONFIG.projectVersion}",
      "source": "${prdPath}",
      "description": "Tasks generated from ${prdPath.split('/').pop()}"
    },
    "tasks": [
      {
        "id": 1,
        "title": "Set up project scaffolding",
        "description": "Initialize repository structure with Wrangler configuration for Cloudflare Workers, set up D1 database schema, and configure development environment.",
        "status": "pending",
        "dependencies": [],
        "priority": "high",
        "details": "Create the initial project structure including:\n- Wrangler configuration for Cloudflare Workers\n- D1 database schema setup\n- Development environment configuration\n- Basic folder structure for the project",
        "testStrategy": "Verify that the project structure is set up correctly and that the development environment can be started without errors."
      },
      {
        "id": 2,
        "title": "Implement GitHub OAuth flow",
        "description": "Create authentication system using GitHub OAuth for user sign-up and login, storing authenticated user profiles in D1 database.",
        "status": "pending",
        "dependencies": [1],
        "priority": "${CONFIG.defaultPriority}",
        "details": "Implement the GitHub OAuth flow for user authentication:\n- Create OAuth application in GitHub\n- Implement OAuth callback endpoint\n- Store user profiles in D1 database\n- Create session management",
        "testStrategy": "Test the complete OAuth flow from login to callback to session creation. Verify user data is correctly stored in the database."
      }
    ]
  }`

  let systemPrompt = "You are a helpful assistant that generates tasks from a PRD using the below json template. You don't worry much about non-task related content, nor do you worry about tasks that don't particularly add value to an mvp. Things like implementing security enhancements, documentation, expansive testing etc are nice to have. The most important is to turn the PRD into a task list that fully materializes the product enough so it can go to market. The JSON template goes as follows -- make sure to only return the json, nothing else: " + TASKS_JSON_TEMPLATE + "ONLY RETURN THE JSON, NOTHING ELSE.";
  
  // Add instruction about the number of tasks if specified
  if (numTasks) {
    systemPrompt += ` Generate exactly ${numTasks} tasks.`;
  } else {
    systemPrompt += " Generate a comprehensive set of tasks that covers all requirements in the PRD.";
  }

  log('debug', "System prompt:", systemPrompt);
  
  try {
    // Calculate appropriate max tokens based on PRD size
    let maxTokens = CONFIG.maxTokens;
    // Rough estimate: 1 token ≈ 4 characters
    const estimatedPrdTokens = Math.ceil(prdContent.length / 4);
    // Ensure we have enough tokens for the response
    if (estimatedPrdTokens > maxTokens / 2) {
      // If PRD is large, increase max tokens if possible
      const suggestedMaxTokens = Math.min(32000, estimatedPrdTokens * 2);
      if (suggestedMaxTokens > maxTokens) {
        log('info', `PRD is large (est. ${estimatedPrdTokens} tokens). Increasing max_tokens to ${suggestedMaxTokens}.`);
        maxTokens = suggestedMaxTokens;
      }
    }
    
    // Always use streaming to avoid "Streaming is strongly recommended" error
    log('info', `Using streaming API for PRD processing...`);
    return await handleStreamingRequest(prdContent, prdPath, numTasks, maxTokens, systemPrompt, loadingIndicator);
    
  } catch (error) {
    // Stop loading indicator
    stopLoadingIndicator(loadingIndicator);
    
    log('error', "Error calling Claude API:", error);
    
    // Implement exponential backoff for retries
    if (retryCount < MAX_RETRIES) {
      const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
      log('info', `Retrying in ${backoffTime/1000} seconds (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      // If we have a numTasks parameter and it's greater than 3, try again with fewer tasks
      if (numTasks && numTasks > 3) {
        const reducedTasks = Math.max(3, Math.floor(numTasks * 0.7)); // Reduce by 30%, minimum 3
        log('info', `Retrying with reduced task count: ${reducedTasks} (was ${numTasks})`);
        return callClaude(prdContent, prdPath, reducedTasks, retryCount + 1);
      } else {
        // Otherwise, just retry with the same parameters
        return callClaude(prdContent, prdPath, numTasks, retryCount + 1);
      }
    }
    
    // If we've exhausted all retries, ask the user what to do
    console.log("\nClaude API call failed after multiple attempts.");
    console.log("Options:");
    console.log("1. Retry with the same parameters");
    console.log("2. Retry with fewer tasks (if applicable)");
    console.log("3. Abort");
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve, reject) => {
      readline.question('Enter your choice (1-3): ', async (choice) => {
        readline.close();
        
        switch (choice) {
          case '1':
            console.log("Retrying with the same parameters...");
            resolve(await callClaude(prdContent, prdPath, numTasks, 0)); // Reset retry count
            break;
          case '2':
            if (numTasks && numTasks > 2) {
              const reducedTasks = Math.max(2, Math.floor(numTasks * 0.5)); // Reduce by 50%, minimum 2
              console.log(`Retrying with reduced task count: ${reducedTasks} (was ${numTasks})...`);
              resolve(await callClaude(prdContent, prdPath, reducedTasks, 0)); // Reset retry count
            } else {
              console.log("Cannot reduce task count further. Retrying with the same parameters...");
              resolve(await callClaude(prdContent, prdPath, numTasks, 0)); // Reset retry count
            }
            break;
          case '3':
          default:
            console.log("Aborting...");
            reject(new Error("User aborted after multiple failed attempts"));
            break;
        }
      });
    });
  }
}

// Helper function to handle streaming requests to Claude API
async function handleStreamingRequest(prdContent, prdPath, numTasks, maxTokens, systemPrompt, loadingIndicator) {
  log('info', "Sending streaming request to Claude API...");
  
  let fullResponse = '';
  let streamComplete = false;
  let streamError = null;
  let streamingInterval = null; // Initialize streamingInterval here

  try {
    const stream = await anthropic.messages.create({
      max_tokens: maxTokens,
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      messages: [{ role: "user", content: prdContent }],
      system: systemPrompt,
      stream: true
    });
    
    // Update loading indicator to show streaming progress
    let dotCount = 0;
    streamingInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
      dotCount = (dotCount + 1) % 4;
    }, 500);
    
    // Process the stream
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        fullResponse += chunk.delta.text;
      }
    }
    
    clearInterval(streamingInterval);
    streamComplete = true;
    
    // Stop loading indicator
    stopLoadingIndicator(loadingIndicator);
    log('info', "Completed streaming response from Claude API!");
    log('debug', `Streaming response length: ${fullResponse.length} characters`);
    
    return processClaudeResponse(fullResponse, numTasks, 0, prdContent, prdPath);
  } catch (error) {
    if (streamingInterval) clearInterval(streamingInterval); // Safely clear interval
    stopLoadingIndicator(loadingIndicator);
    log('error', "Error during streaming response:", error);
    throw error;
  }
}

// Helper function to process Claude's response text
function processClaudeResponse(textContent, numTasks, retryCount, prdContent, prdPath) {
  try {
    // Check if the response is wrapped in a Markdown code block and extract the JSON
    log('info', "Parsing response as JSON...");
    let jsonText = textContent;
    const codeBlockMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      log('debug', "Detected JSON wrapped in Markdown code block, extracting...");
      jsonText = codeBlockMatch[1];
    }
    
    // Try to parse the response as JSON
    const parsedJson = JSON.parse(jsonText);
    
    // Check if the response seems incomplete (e.g., missing closing brackets)
    if (!parsedJson.tasks || parsedJson.tasks.length === 0) {
      log('warn', "Parsed JSON has no tasks. Response may be incomplete.");
      
      // If we have a numTasks parameter and it's greater than 5, try again with fewer tasks
      if (numTasks && numTasks > 5 && retryCount < MAX_RETRIES) {
        const reducedTasks = Math.max(5, Math.floor(numTasks * 0.7)); // Reduce by 30%, minimum 5
        log('info', `Retrying with reduced task count: ${reducedTasks} (was ${numTasks})`);
        return callClaude(prdContent, prdPath, reducedTasks, retryCount + 1);
      }
    }
    
    log('info', `Successfully parsed JSON with ${parsedJson.tasks?.length || 0} tasks`);
    return parsedJson;
  } catch (error) {
    log('error', "Failed to parse Claude's response as JSON:", error);
    log('debug', "Raw response:", textContent);
    
    // Check if we should retry with different parameters
    if (retryCount < MAX_RETRIES) {
      // If we have a numTasks parameter, try again with fewer tasks
      if (numTasks && numTasks > 3) {
        const reducedTasks = Math.max(3, Math.floor(numTasks * 0.6)); // Reduce by 40%, minimum 3
        log('info', `Retrying with reduced task count: ${reducedTasks} (was ${numTasks})`);
        return callClaude(prdContent, prdPath, reducedTasks, retryCount + 1);
      } else {
        // Otherwise, just retry with the same parameters
        log('info', `Retrying Claude API call (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        return callClaude(prdContent, prdPath, numTasks, retryCount + 1);
      }
    }
    
    throw new Error("Failed to parse Claude's response as JSON after multiple attempts. See console for details.");
  }
}

//
// 1) parse-prd
//
async function parsePRD(prdPath, tasksPath, numTasks) {
  displayBanner();
  
  if (!fs.existsSync(prdPath)) {
    log('error', `PRD file not found: ${prdPath}`);
    process.exit(1);
  }

  const headerBox = boxen(
    chalk.white.bold(`Parsing PRD Document: ${chalk.cyan(path.basename(prdPath))}`), 
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  );
  console.log(headerBox);

  log('info', `Reading PRD file from: ${prdPath}`);
  const prdContent = fs.readFileSync(prdPath, 'utf8');
  log('info', `PRD file read successfully. Content length: ${prdContent.length} characters`);

  // call claude to generate the tasks.json
  log('info', "Calling Claude to generate tasks from PRD...");
  
  try {
    const loadingSpinner = startLoadingIndicator('Generating tasks with Claude AI');
    const claudeResponse = await callClaude(prdContent, prdPath, numTasks);
    let tasks = claudeResponse.tasks || [];
    stopLoadingIndicator(loadingSpinner);
    
    log('success', `Claude generated ${tasks.length} tasks from the PRD`);

    // Limit the number of tasks if specified
    if (numTasks && numTasks > 0 && numTasks < tasks.length) {
      log('info', `Limiting to the first ${numTasks} tasks as specified`);
      tasks = tasks.slice(0, numTasks);
    }

    log('info', "Creating tasks.json data structure...");
    const data = {
      meta: {
        projectName: CONFIG.projectName,
        version: CONFIG.projectVersion,
        source: prdPath,
        description: "Tasks generated from PRD",
        totalTasksGenerated: claudeResponse.tasks?.length || 0,
        tasksIncluded: tasks.length
      },
      tasks
    };

    // Validate and fix dependencies in the generated tasks
    log('info', "Validating dependencies in generated tasks...");
    const dependencyChanges = validateAndFixDependencies(data, null);
    if (dependencyChanges) {
      log('info', "Fixed some invalid dependencies in the generated tasks");
    } else {
      log('info', "All dependencies in generated tasks are valid");
    }

    log('info', `Writing ${tasks.length} tasks to ${tasksPath}...`);
    writeJSON(tasksPath, data);
    
    // Show success message in a box
    const successBox = boxen(
      chalk.green(`Successfully parsed PRD from: ${chalk.cyan(prdPath)}\n`) +
      chalk.green(`Generated ${chalk.bold(tasks.length)} tasks in: ${chalk.cyan(tasksPath)}`),
      { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    );
    console.log(successBox);
    
    // Show the first few tasks in a table
    const previewTasks = tasks.slice(0, Math.min(5, tasks.length));
    const taskTable = new Table({
      head: [chalk.cyan.bold('ID'), chalk.cyan.bold('Title'), chalk.cyan.bold('Priority')],
      colWidths: [6, 60, 12],
      style: { head: [], border: [] }
    });
    
    previewTasks.forEach(task => {
      taskTable.push([
        task.id.toString(),
        task.title,
        chalk.yellow(task.priority || 'medium')
      ]);
    });
    
    if (tasks.length > 5) {
      taskTable.push([
        '...',
        chalk.dim(`${tasks.length - 5} more tasks`),
        ''
      ]);
    }
    
    console.log(boxen(
      chalk.white.bold('Task Preview:'),
      { padding: { left: 2, right: 2, top: 0, bottom: 0 }, margin: { top: 1, bottom: 0 }, borderColor: 'blue', borderStyle: 'round' }
    ));
    console.log(taskTable.toString());
    
    // Next steps suggestion
    console.log(boxen(
      chalk.white.bold('Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow('node scripts/dev.js generate')} to create individual task files\n` +
      `${chalk.cyan('2.')} Run ${chalk.yellow('node scripts/dev.js list')} to see all tasks\n` +
      `${chalk.cyan('3.')} Run ${chalk.yellow('node scripts/dev.js analyze-complexity')} to plan task breakdown`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
    ));
    
  } catch (error) {
    log('error', "Failed to generate tasks:", error.message);
    process.exit(1);
  }
}

//
// 2) update
//
async function updateTasks(tasksPath, fromId, prompt) {
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "Invalid or missing tasks.json.");
    process.exit(1);
  }

  log('info', `Updating tasks from ID >= ${fromId} with prompt: ${prompt}`);

  const tasksToUpdate = data.tasks.filter(task => task.id >= fromId && task.status !== "done");
  
  const systemPrompt = "You are a helpful assistant that updates tasks based on provided insights. Return only the updated tasks as a JSON array.";
  const userPrompt = `Update these tasks based on the following insight: ${prompt}\nTasks: ${JSON.stringify(tasksToUpdate, null, 2)}`;
  
  // Start loading indicator
  const loadingIndicator = startLoadingIndicator("Waiting for Claude to update tasks...");
  
  let fullResponse = '';
  let streamingInterval = null;

  try {
    const stream = await anthropic.messages.create({
      max_tokens: CONFIG.maxTokens,
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
      stream: true
    });
    
    // Update loading indicator to show streaming progress
    let dotCount = 0;
    streamingInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
      dotCount = (dotCount + 1) % 4;
    }, 500);
    
    // Process the stream
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        fullResponse += chunk.delta.text;
      }
    }
    
    clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    log('info', "Completed streaming response from Claude API!");
    log('debug', `Streaming response length: ${fullResponse.length} characters`);

    try {
      const updatedTasks = JSON.parse(fullResponse);
      
      data.tasks = data.tasks.map(task => {
        const updatedTask = updatedTasks.find(t => t.id === task.id);
        return updatedTask || task;
      });

      // Validate and fix dependencies after task updates
      log('info', "Validating dependencies after task updates...");
      const dependencyChanges = validateAndFixDependencies(data, null);
      if (dependencyChanges) {
        log('info', "Fixed some dependencies that became invalid after task updates");
      }

      writeJSON(tasksPath, data);
      log('info', "Tasks updated successfully.");
      
      // Add call to generate task files
      log('info', "Regenerating task files...");
      await generateTaskFiles(tasksPath, path.dirname(tasksPath));
      
    } catch (parseError) {
      log('error', "Failed to parse Claude's response as JSON:", parseError);
      log('debug', "Response content:", fullResponse);
      process.exit(1);
    }
  } catch (error) {
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    log('error', "Error during streaming response:", error);
    process.exit(1);
  }
}

//
// 3) generate
//
function generateTaskFiles(tasksPath, outputDir) {
  log('info', `Reading tasks from ${tasksPath}...`);
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks to generate files for.");
    process.exit(1);
  }
  
  log('info', `Found ${data.tasks.length} tasks to generate files for.`);
  
  // Validate and fix dependencies before generating files
  log('info', "Validating and fixing dependencies before generating files...");
  const changesDetected = validateAndFixDependencies(data, tasksPath);
  if (changesDetected) {
    log('info', "Fixed some invalid dependencies in the tasks");
  } else {
    log('debug', "All dependencies are valid");
  }
  
  // The outputDir is now the same directory as tasksPath, so we don't need to check if it exists
  // since we already did that in the main function
  
  log('info', "Generating individual task files...");
  data.tasks.forEach(task => {
    const filename = `task_${String(task.id).padStart(3, '0')}.txt`;
    const filepath = path.join(outputDir, filename);

    // Create the base content
    const contentParts = [
      `# Task ID: ${task.id}`,
      `# Title: ${task.title}`,
      `# Status: ${task.status}`,
      `# Dependencies: ${formatDependenciesWithStatus(task.dependencies, data.tasks, false)}`,
      `# Priority: ${task.priority}`,
      `# Description: ${task.description}`,
      `# Details:\n${task.details}\n`,
      `# Test Strategy:`,
      `${task.testStrategy}\n`
    ];
    
    // Add subtasks if they exist
    if (task.subtasks && task.subtasks.length > 0) {
      contentParts.push(`# Subtasks:`);
      task.subtasks.forEach(subtask => {
        // Format subtask dependencies correctly by converting numeric IDs to parent.subtask format
        let formattedDeps = [];
        if (subtask.dependencies && subtask.dependencies.length > 0) {
          // Format each dependency - this is a key change
          formattedDeps = subtask.dependencies.map(depId => {
            // If it already has a dot notation (e.g. "1.2"), keep it as is
            if (typeof depId === 'string' && depId.includes('.')) {
              // Validate that this subtask dependency actually exists
              const [parentId, subId] = depId.split('.').map(id => isNaN(id) ? id : Number(id));
              const parentTask = data.tasks.find(t => t.id === parentId);
              if (!parentTask || !parentTask.subtasks || !parentTask.subtasks.some(s => s.id === Number(subId))) {
                log('warn', `Skipping non-existent subtask dependency: ${depId}`);
                return null;
              }
              return depId;
            } 
            // If it's a number, it's probably referencing a parent subtask in the same task
            // Format it as "parentTaskId.subtaskId"
            else if (typeof depId === 'number') {
              // Check if this is likely a subtask ID (small number) within the same parent task
              if (depId < 100) { // Assume subtask IDs are small numbers
                // Validate that this subtask exists
                if (!task.subtasks.some(s => s.id === depId)) {
                  log('warn', `Skipping non-existent subtask dependency: ${task.id}.${depId}`);
                  return null;
                }
                return `${task.id}.${depId}`;
              } else {
                // It's a reference to another task - validate it exists
                if (!data.tasks.some(t => t.id === depId)) {
                  log('warn', `Skipping non-existent task dependency: ${depId}`);
                  return null;
                }
                return depId;
              }
            }
            return depId;
          }).filter(dep => dep !== null); // Remove null entries (invalid dependencies)
        }
        
        const subtaskDeps = formattedDeps.length > 0
          ? formatDependenciesWithStatus(formattedDeps, data.tasks, false)
          : "None";
          
        contentParts.push(`## Subtask ID: ${subtask.id}`);
        contentParts.push(`## Title: ${subtask.title}`);
        contentParts.push(`## Status: ${subtask.status}`);
        contentParts.push(`## Dependencies: ${subtaskDeps}`);
        contentParts.push(`## Description: ${subtask.description}`);
        if (subtask.acceptanceCriteria) {
          contentParts.push(`## Acceptance Criteria:\n${subtask.acceptanceCriteria}\n`);
        }
      });
    }

    const content = contentParts.join('\n');
    fs.writeFileSync(filepath, content, 'utf8');
    log('info', `Generated: ${filename}`);
  });

  log('info', `All ${data.tasks.length} tasks have been generated into '${outputDir}'.`);
}

//
// 4) set-status
//
function setTaskStatus(tasksPath, taskIdInput, newStatus) {
  displayBanner();
  
  // Validate inputs
  if (!taskIdInput || !newStatus) {
    log('error', 'Task ID and new status are required');
    process.exit(1);
  }

  // Read fresh data for each status update
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', 'No valid tasks found in tasks.json');
    process.exit(1);
  }

  console.log(boxen(
    chalk.white.bold(`Updating Task Status to: ${getStatusWithColor(newStatus)}`),
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));

  // Handle multiple task IDs (comma-separated)
  if (typeof taskIdInput === 'string' && taskIdInput.includes(',')) {
    const taskIds = taskIdInput.split(',').map(id => id.trim());
    log('info', `Processing multiple task IDs: ${taskIds.join(', ')}`);
    
    // Create a summary table for the updates
    const summaryTable = new Table({
      head: [
        chalk.cyan.bold('ID'), 
        chalk.cyan.bold('Title'), 
        chalk.cyan.bold('Old Status'), 
        chalk.cyan.bold('New Status')
      ],
      colWidths: [8, 40, 15, 15],
      style: { 
        head: [], 
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      }
    });
    
    // Process each task ID individually
    taskIds.forEach(id => {
      const result = updateSingleTaskStatus(tasksPath, id, newStatus, data);
      if (result) {
        summaryTable.push([
          result.id,
          truncate(result.title, 37),
          getStatusWithColor(result.oldStatus),
          getStatusWithColor(result.newStatus)
        ]);
        
        // Add subtask updates if any
        if (result.subtasks && result.subtasks.length > 0) {
          result.subtasks.forEach(sub => {
            summaryTable.push([
              `  ${sub.id}`,
              `  ↳ ${truncate(sub.title, 35)}`,
              getStatusWithColor(sub.oldStatus),
              getStatusWithColor(sub.newStatus)
            ]);
          });
        }
      }
    });
    
    // Validate dependencies after status updates
    log('info', "Validating dependencies after status updates...");
    const dependencyChanges = validateAndFixDependencies(data, null);
    if (dependencyChanges) {
      log('info', "Fixed some dependencies that became invalid after status changes");
    }
    
    // Save the changes
    writeJSON(tasksPath, data);
    
    // Regenerate task files
    log('info', "Regenerating task files...");
    generateTaskFiles(tasksPath, path.dirname(tasksPath));
    
    // Show the summary table
    console.log(boxen(
      chalk.white.bold('Status Update Summary:'),
      { padding: { left: 2, right: 2, top: 0, bottom: 0 }, margin: { top: 1, bottom: 0 }, borderColor: 'blue', borderStyle: 'round' }
    ));
    console.log(summaryTable.toString());
    
    return;
  }

  // Handle regular task ID or subtask ID
  const result = updateSingleTaskStatus(tasksPath, taskIdInput, newStatus, data);
  
  if (result) {
    // Validate dependencies after status update
    log('info', "Validating dependencies after status update...");
    const dependencyChanges = validateAndFixDependencies(data, null);
    if (dependencyChanges) {
      log('info', "Fixed some dependencies that became invalid after status change");
    }
    
    // Save the changes
    writeJSON(tasksPath, data);
    
    // Regenerate task files
    log('info', "Regenerating task files...");
    generateTaskFiles(tasksPath, path.dirname(tasksPath));
    
    // Show success message
    const successBox = boxen(
      chalk.green(`Successfully updated task ${chalk.bold(result.id)} status:\n`) +
      `From: ${getStatusWithColor(result.oldStatus)}\n` +
      `To:   ${getStatusWithColor(result.newStatus)}`,
      { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    );
    console.log(successBox);
    
    // If subtasks were also updated, show them
    if (result.subtasks && result.subtasks.length > 0) {
      const subtaskTable = new Table({
        head: [
          chalk.cyan.bold('ID'), 
          chalk.cyan.bold('Title'), 
          chalk.cyan.bold('Old Status'), 
          chalk.cyan.bold('New Status')
        ],
        colWidths: [8, 40, 15, 15],
        style: { 
          head: [], 
          border: [],
          'padding-top': 0,
          'padding-bottom': 0,
          compact: true
        },
        chars: {
          'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
        }
      });
      
      result.subtasks.forEach(sub => {
        subtaskTable.push([
          `  ${sub.id}`,
          `  ↳ ${truncate(sub.title, 35)}`,
          getStatusWithColor(sub.oldStatus),
          getStatusWithColor(sub.newStatus)
        ]);
      });
      
      console.log(boxen(
        chalk.white.bold('Subtasks Also Updated:'),
        { padding: { left: 2, right: 2, top: 0, bottom: 0 }, margin: { top: 1, bottom: 0 }, borderColor: 'blue', borderStyle: 'round' }
      ));
      console.log(subtaskTable.toString());
    }
  }
}

// Helper function to update a single task status and return details for UI
function updateSingleTaskStatus(tasksPath, taskIdInput, newStatus, data) {
  // Handle subtask IDs (e.g., "1.1")
  if (String(taskIdInput).includes('.')) {
    const [parentIdStr, subtaskIdStr] = String(taskIdInput).split('.');
    const parentId = parseInt(parentIdStr, 10);
    const subtaskId = parseInt(subtaskIdStr, 10);

    if (isNaN(parentId) || isNaN(subtaskId)) {
      log('error', `Invalid subtask ID format: ${taskIdInput}`);
      return null;
    }

    // Find the parent task
    const parentTask = data.tasks.find(t => t.id === parentId);
    if (!parentTask) {
      log('error', `Parent task ${parentId} not found`);
      return null;
    }

    // Ensure subtasks array exists
    if (!parentTask.subtasks || !Array.isArray(parentTask.subtasks)) {
      log('error', `Parent task ${parentId} has no subtasks array`);
      return null;
    }

    // Find and update the subtask
    const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      log('error', `Subtask ${subtaskId} not found in task ${parentId}`);
      return null;
    }

    // Update the subtask status
    const oldStatus = subtask.status || 'pending';
    subtask.status = newStatus;
    
    return {
      id: `${parentId}.${subtaskId}`,
      title: subtask.title,
      oldStatus: oldStatus,
      newStatus: newStatus
    };
  }

  // Handle regular task ID
  const taskId = parseInt(String(taskIdInput), 10);
  if (isNaN(taskId)) {
    log('error', `Invalid task ID: ${taskIdInput}`);
    return null;
  }

  // Find the task
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) {
    log('error', `Task ${taskId} not found`);
    return null;
  }

  // Update the task status
  const oldStatus = task.status || 'pending';
  task.status = newStatus;
  
  const result = {
    id: taskId.toString(),
    title: task.title,
    oldStatus: oldStatus,
    newStatus: newStatus,
    subtasks: []
  };
  
  // Automatically update subtasks if the parent task is being marked as done
  if (newStatus === 'done' && task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
    log('info', `Task ${taskId} has ${task.subtasks.length} subtasks that will be marked as done too.`);
    
    task.subtasks.forEach(subtask => {
      const oldSubtaskStatus = subtask.status || 'pending';
      subtask.status = newStatus;
      
      result.subtasks.push({
        id: `${taskId}.${subtask.id}`,
        title: subtask.title,
        oldStatus: oldSubtaskStatus,
        newStatus: newStatus
      });
    });
  }
  
  return result;
}

/**
 * Get a colored version of the status string
 * @param {string} status - The status string
 * @returns {string} - The colored status string
 */
function getStatusWithColor(status) {
  const statusColor = {
    'done': chalk.green,
    'completed': chalk.green,
    'pending': chalk.yellow,
    'in-progress': chalk.blue,
    'deferred': chalk.gray
  }[status] || chalk.white;
  
  return statusColor(status);
}

/**
 * Format dependencies with emoji indicators for completion status
 * In CLI/console output use colors, in file output use emojis
 * @param {Array} dependencies - Array of dependency IDs
 * @param {Array} allTasks - Array of all tasks
 * @param {boolean} forConsole - Whether this is for console output (true) or file output (false)
 * @returns {string} - Formatted dependencies with status indicators
 */
function formatDependenciesWithStatus(dependencies, allTasks, forConsole = false) {
  if (!dependencies || dependencies.length === 0) {
    return 'None';
  }
  
  // Create a map of completed task IDs for quick lookup
  const completedTaskIds = new Set(
    allTasks
      .filter(t => t.status === 'done' || t.status === 'completed')
      .map(t => t.id)
  );
  
  // Create a map of subtask statuses for quick lookup
  const subtaskStatusMap = new Map();
  allTasks.forEach(task => {
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach(subtask => {
        subtaskStatusMap.set(`${task.id}.${subtask.id}`, subtask.status || 'pending');
      });
    }
  });
  
  // Map each dependency to include its status indicator
  return dependencies.map(depId => {
    // Check if it's a subtask dependency (e.g., "1.2")
    const isSubtask = typeof depId === 'string' && depId.includes('.');
    
    let isDone = false;
    let status = 'pending';
    
    if (isSubtask) {
      // For subtask dependency
      status = subtaskStatusMap.get(depId) || 'pending';
      isDone = status === 'done' || status === 'completed';
    } else {
      // For regular task dependency
      isDone = completedTaskIds.has(depId);
      // Find the task to get its status
      const depTask = allTasks.find(t => t.id === depId);
      status = depTask ? (depTask.status || 'pending') : 'pending';
    }
    
    if (forConsole) {
      // For console output, use colors
      if (status === 'done' || status === 'completed') {
        return chalk.green(depId.toString());
      } else if (status === 'in-progress') {
        return chalk.yellow(depId.toString());
      } else {
        return chalk.red(depId.toString());
      }
    } else {
      // For file output, use emojis
      let statusEmoji = '⏱️'; // Default to pending
      if (status === 'done' || status === 'completed') {
        statusEmoji = '✅';
      } else if (status === 'in-progress') {
        statusEmoji = '🔄';
      }
      return `${depId} ${statusEmoji}`;
    }
  }).join(', ');
}

//
// 5) list tasks
//
function listTasks(tasksPath, statusFilter, withSubtasks = false) {
  displayBanner();
  
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks found.");
    process.exit(1);
  }

  // Filter tasks by status if a filter is provided
  const filteredTasks = statusFilter 
    ? data.tasks.filter(t => t.status === statusFilter)
    : data.tasks;
  
  // Count statistics for metrics
  const doneCount = data.tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
  const pendingCount = data.tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = data.tasks.filter(t => t.status === 'in-progress').length;
  const deferredCount = data.tasks.filter(t => t.status === 'deferred').length;
  const otherCount = data.tasks.length - doneCount - pendingCount - inProgressCount - deferredCount;
  
  // Count tasks by priority
  const highPriorityCount = data.tasks.filter(t => t.priority === 'high').length;
  const mediumPriorityCount = data.tasks.filter(t => t.priority === 'medium').length;
  const lowPriorityCount = data.tasks.filter(t => t.priority === 'low').length;
  
  // Calculate progress percentage
  const progressPercent = Math.round((doneCount / data.tasks.length) * 100);
  const progressBar = createProgressBar(progressPercent, 30);
  
  // Count blocked tasks (pending with dependencies that aren't done)
  let blockedCount = 0;
  data.tasks.filter(t => t.status === 'pending').forEach(task => {
    if (task.dependencies && task.dependencies.length > 0) {
      const hasPendingDeps = task.dependencies.some(depId => {
        const depTask = data.tasks.find(t => t.id === depId);
        return depTask && depTask.status !== 'done' && depTask.status !== 'completed';
      });
      if (hasPendingDeps) blockedCount++;
    }
  });
  
  // Count subtasks
  let totalSubtasks = 0;
  let completedSubtasks = 0;
  data.tasks.forEach(task => {
    if (task.subtasks && Array.isArray(task.subtasks)) {
      totalSubtasks += task.subtasks.length;
      completedSubtasks += task.subtasks.filter(st => 
        st.status === 'done' || st.status === 'completed'
      ).length;
    }
  });
  
  // Calculate subtask progress
  const subtaskProgressPercent = totalSubtasks > 0 
    ? Math.round((completedSubtasks / totalSubtasks) * 100) 
    : 0;
  const subtaskProgressBar = createProgressBar(subtaskProgressPercent, 30);
  
  // Display the dashboard first
  console.log(boxen(
    chalk.white.bold('Project Dashboard\n') +
    `${chalk.bold('Tasks Progress:')} ${progressBar} ${progressPercent}%\n` +
    `${chalk.green.bold('Done:')} ${doneCount}  ${chalk.blue.bold('In Progress:')} ${inProgressCount}  ${chalk.yellow.bold('Pending:')} ${pendingCount}  ${chalk.red.bold('Blocked:')} ${blockedCount}  ${chalk.gray.bold('Deferred:')} ${deferredCount}\n` +
    '\n' +
    `${chalk.bold('Subtasks Progress:')} ${subtaskProgressBar} ${subtaskProgressPercent}%\n` +
    `${chalk.green.bold('Completed:')} ${completedSubtasks}/${totalSubtasks}  ${chalk.yellow.bold('Remaining:')} ${totalSubtasks - completedSubtasks}\n` +
    '\n' +
    `${chalk.bold('Priority Breakdown:')}\n` +
    `${chalk.red.bold('High:')} ${highPriorityCount}  ${chalk.yellow.bold('Medium:')} ${mediumPriorityCount}  ${chalk.gray.bold('Low:')} ${lowPriorityCount}`,
    { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 0, bottom: 0 } }
  ));
  
  // Get terminal width for dynamic sizing
  const terminalWidth = process.stdout.columns || 100;
  
  // Create a table for better visualization
  const table = new Table({
    head: [
      chalk.cyan.bold('ID'), 
      chalk.cyan.bold('Status'), 
      chalk.cyan.bold('Priority'),
      chalk.cyan.bold('Title'),
      chalk.cyan.bold('Dependencies')
    ],
    colWidths: [
      8, // ID
      12, // Status
      10, // Priority
      Math.floor(terminalWidth * 0.45), // Title - 45% of terminal width
      Math.floor(terminalWidth * 0.25)  // Dependencies - 25% of terminal width
    ],
    style: {
      head: [],
      border: []
    },
    chars: {
      'top': '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      'bottom': '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      'left': '│',
      'left-mid': '├',
      'mid': '─',
      'mid-mid': '┼',
      'right': '│',
      'right-mid': '┤',
      'middle': '│'
    },
    wordWrap: true
  });
  
  // Status colors
  const statusColors = {
    'done': chalk.green,
    'completed': chalk.green,
    'pending': chalk.yellow,
    'deferred': chalk.gray,
    'in-progress': chalk.blue,
    'blocked': chalk.red
  };
  
  // Priority colors
  const priorityColors = {
    'high': chalk.red.bold,
    'medium': chalk.yellow,
    'low': chalk.gray
  };
  
  filteredTasks.forEach(t => {
    const statusColor = statusColors[t.status] || chalk.white;
    const priorityColor = priorityColors[t.priority] || chalk.white;
    
    // Format dependencies with status indicators for parent tasks
    const formattedDeps = formatDependenciesWithStatus(t.dependencies, data.tasks, true);
    
    // Get the max title length for the title column with some margin for padding
    const titleMaxLength = Math.floor(terminalWidth * 0.45) - 5;
    
    // Truncate long titles if necessary
    const truncatedTitle = t.title.length > titleMaxLength 
      ? t.title.substring(0, titleMaxLength - 3) + '...' 
      : t.title;
    
    table.push([
      t.id.toString(), 
      statusColor(t.status), 
      priorityColor(t.priority || 'medium'),
      truncatedTitle,
      formattedDeps
    ]);
    
    // Display subtasks if requested and they exist
    if (withSubtasks && t.subtasks && t.subtasks.length > 0) {
      t.subtasks.forEach(st => {
        const subtaskStatusColor = statusColors[st.status || 'pending'] || chalk.white;
        
        // Format subtask dependencies with status indicators
        let subtaskDeps = 'None';
        if (st.dependencies && st.dependencies.length > 0) {
          // Convert numeric dependencies to proper format if they're likely subtask references
          const formattedSubtaskDeps = st.dependencies.map(depId => {
            if (typeof depId === 'number' && depId < 100) {
              return `${t.id}.${depId}`;
            }
            return depId;
          });
          
          subtaskDeps = formatDependenciesWithStatus(formattedSubtaskDeps, data.tasks, true);
        }
        
        // Truncate subtask titles
        const subtaskTitleMaxLength = Math.floor(terminalWidth * 0.45) - 7; // Slightly shorter to account for the arrow prefix
        const truncatedSubtaskTitle = st.title.length > subtaskTitleMaxLength 
          ? st.title.substring(0, subtaskTitleMaxLength - 3) + '...' 
          : st.title;
        
        table.push([
          `  ${t.id}.${st.id}`, 
          subtaskStatusColor(st.status || 'pending'), 
          '',
          `  ↳ ${truncatedSubtaskTitle}`,
          subtaskDeps
        ]);
      });
    }
  });
  
  if (filteredTasks.length === 0) {
    console.log(boxen(
      chalk.yellow(`No tasks found${statusFilter ? ` with status '${statusFilter}'` : ''}.`),
      { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
    ));
  } else {
    // Display the header with task count and filter info
    const header = statusFilter 
      ? `Tasks with status: ${chalk.bold(statusFilter)} (${filteredTasks.length} of ${data.tasks.length} total)`
      : `All Tasks (${filteredTasks.length})`;
    
    console.log(boxen(chalk.white.bold(header), {
      padding: { left: 2, right: 2, top: 0, bottom: 0 },
      margin: { top: 1, bottom: 1 },
      borderColor: 'blue',
      borderStyle: 'round'
    }));
    
    console.log(table.toString());
  }
}

// Helper function to create a progress bar
function createProgressBar(percent, length) {
  const filledLength = Math.round(length * percent / 100);
  const emptyLength = length - filledLength;
  
  const filled = '█'.repeat(filledLength);
  const empty = '░'.repeat(emptyLength);
  
  return chalk.green(filled) + chalk.gray(empty);
}

//
// 6) expand task with subtasks
//
/**
 * Expand a task by generating subtasks
 * @param {string} taskId - The ID of the task to expand
 * @param {number} numSubtasks - The number of subtasks to generate
 * @param {boolean} useResearch - Whether to use Perplexity for research-backed subtask generation
 * @returns {Promise<void>}
 */
async function expandTask(taskId, numSubtasks = CONFIG.defaultSubtasks, useResearch = false, additionalContext = '') {
  try {
    // Get the tasks
    const tasksData = readJSON(path.join(process.cwd(), 'tasks', 'tasks.json'));
    const task = tasksData.tasks.find(t => t.id === parseInt(taskId));
    
    if (!task) {
      console.error(chalk.red(`Task with ID ${taskId} not found.`));
      return;
    }
    
    // Check if the task is already completed
    if (task.status === 'completed' || task.status === 'done') {
      console.log(chalk.yellow(`Task ${taskId} is already completed. Skipping expansion.`));
      return;
    }
    
    // Check for complexity report
    const complexityReport = readComplexityReport();
    let recommendedSubtasks = numSubtasks;
    let recommendedPrompt = additionalContext;
    
    // If report exists and has data for this task, use it
    if (complexityReport) {
      const taskAnalysis = findTaskInComplexityReport(complexityReport, parseInt(taskId));
      if (taskAnalysis) {
        // Only use report values if not explicitly overridden by command line
        if (numSubtasks === CONFIG.defaultSubtasks && taskAnalysis.recommendedSubtasks) {
          recommendedSubtasks = taskAnalysis.recommendedSubtasks;
          console.log(chalk.blue(`Using recommended subtask count from complexity analysis: ${recommendedSubtasks}`));
        }
        
        if (!additionalContext && taskAnalysis.expansionPrompt) {
          recommendedPrompt = taskAnalysis.expansionPrompt;
          console.log(chalk.blue(`Using recommended prompt from complexity analysis`));
          console.log(chalk.gray(`Prompt: ${recommendedPrompt.substring(0, 100)}...`));
        }
      }
    }
    
    // Initialize subtasks array if it doesn't exist
    if (!task.subtasks) {
      task.subtasks = [];
    }
    
    // Calculate the next subtask ID
    const nextSubtaskId = task.subtasks.length > 0 
      ? Math.max(...task.subtasks.map(st => st.id)) + 1 
      : 1;
    
    // Generate subtasks
    let subtasks;
    if (useResearch) {
      console.log(chalk.blue(`Using Perplexity AI for research-backed subtask generation...`));
      subtasks = await generateSubtasksWithPerplexity(task, recommendedSubtasks, nextSubtaskId, recommendedPrompt);
    } else {
      subtasks = await generateSubtasks(task, recommendedSubtasks, nextSubtaskId, recommendedPrompt);
    }
    
    // Add the subtasks to the task
    task.subtasks = [...task.subtasks, ...subtasks];
    
    // Validate and fix dependencies for the newly generated subtasks
    console.log(chalk.blue(`Validating dependencies for generated subtasks...`));
    const dependencyChanges = validateAndFixDependencies(tasksData, null);
    if (dependencyChanges) {
      console.log(chalk.yellow(`Fixed some invalid dependencies in the generated subtasks`));
    } else {
      console.log(chalk.green(`All dependencies in generated subtasks are valid`));
    }
    
    // Ensure at least one subtask has no dependencies (entry point)
    const hasIndependentSubtask = task.subtasks.some(st => 
      !st.dependencies || !Array.isArray(st.dependencies) || st.dependencies.length === 0
    );
    
    if (!hasIndependentSubtask && subtasks.length > 0) {
      console.log(chalk.yellow(`Ensuring at least one independent subtask in task ${taskId}`));
      const firstSubtask = subtasks[0];
      firstSubtask.dependencies = [];
    }
    
    // Save the updated tasks
    fs.writeFileSync(
      path.join(process.cwd(), 'tasks', 'tasks.json'),
      JSON.stringify(tasksData, null, 2)
    );
    
    console.log(chalk.green(`Added ${subtasks.length} subtasks to task ${taskId}.`));
    
    // Log the added subtasks
    subtasks.forEach(st => {
      console.log(chalk.cyan(`  ${st.id}. ${st.title}`));
      console.log(chalk.gray(`     ${st.description.substring(0, 100)}${st.description.length > 100 ? '...' : ''}`));
    });
    
    // Generate task files to update the task file with the new subtasks
    console.log(chalk.blue(`Regenerating task files to include new subtasks...`));
    await generateTaskFiles('tasks/tasks.json', 'tasks');
    
  } catch (error) {
    console.error(chalk.red('Error expanding task:'), error);
  }
}

/**
 * Expand all tasks that are not completed
 * @param {number} numSubtasks - The number of subtasks to generate for each task
 * @param {boolean} useResearch - Whether to use Perplexity for research-backed subtask generation
 * @returns {Promise<number>} - The number of tasks expanded
 */
async function expandAllTasks(numSubtasks = CONFIG.defaultSubtasks, useResearch = false, additionalContext = '', forceFlag = false) {
  try {
    // Get the tasks
    const tasksData = readJSON(path.join(process.cwd(), 'tasks', 'tasks.json'));
    
    if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
      console.error(chalk.red('No valid tasks found.'));
      return 0;
    }
    
    // Filter tasks that are not completed
    let tasksToExpand = tasksData.tasks.filter(task => 
      task.status !== 'completed' && task.status !== 'done'
    );
    
    if (tasksToExpand.length === 0) {
      console.log(chalk.yellow('No tasks to expand. All tasks are already completed.'));
      return 0;
    }
    
    // Check for complexity report
    const complexityReport = readComplexityReport();
    let usedComplexityReport = false;
    
    // If complexity report exists, sort tasks by complexity
    if (complexityReport && complexityReport.complexityAnalysis) {
      console.log(chalk.blue('Found complexity report. Prioritizing tasks by complexity score.'));
      usedComplexityReport = true;
      
      // Create a map of task IDs to their complexity scores
      const complexityMap = new Map();
      complexityReport.complexityAnalysis.forEach(analysis => {
        complexityMap.set(analysis.taskId, analysis.complexityScore);
      });
      
      // Sort tasks by complexity score (highest first)
      tasksToExpand.sort((a, b) => {
        const scoreA = complexityMap.get(a.id) || 0;
        const scoreB = complexityMap.get(b.id) || 0;
        return scoreB - scoreA;
      });
      
      // Log the sorted tasks
      console.log(chalk.blue('Tasks will be expanded in this order (by complexity):'));
      tasksToExpand.forEach(task => {
        const score = complexityMap.get(task.id) || 'N/A';
        console.log(chalk.blue(`  Task ${task.id}: ${task.title} (Complexity: ${score})`));
      });
    }
    
    console.log(chalk.blue(`\nExpanding ${tasksToExpand.length} tasks...`));
    
    let tasksExpanded = 0;
    // Keep track of expanded tasks and their results for verification
    const expandedTaskIds = [];
    
    // Expand each task
    for (const task of tasksToExpand) {
      console.log(chalk.blue(`\nExpanding task ${task.id}: ${task.title}`));
      
      // The check for usedComplexityReport is redundant since expandTask will handle it anyway
      await expandTask(task.id, numSubtasks, useResearch, additionalContext);
      expandedTaskIds.push(task.id);
      
      tasksExpanded++;
    }
    
    // Verification step - Check for dummy/generic subtasks
    // Read fresh data after all expansions
    const updatedTasksData = readJSON(path.join(process.cwd(), 'tasks', 'tasks.json'));
    const tasksNeedingRetry = [];
    
    console.log(chalk.blue('\nVerifying subtask quality...'));
    
    for (const taskId of expandedTaskIds) {
      const task = updatedTasksData.tasks.find(t => t.id === taskId);
      if (!task || !task.subtasks || task.subtasks.length === 0) continue;
      
      // Check for generic subtasks - patterns to look for:
      // 1. Auto-generated subtask in description
      // 2. Generic titles like "Subtask X"
      // 3. Common dummy titles we created like "Implementation" without custom descriptions
      const dummySubtasks = task.subtasks.filter(st => 
        st.description.includes("Auto-generated subtask") ||
        st.title.match(/^Subtask \d+$/) ||
        (st.description.includes("Update this auto-generated subtask") && 
         ["Implementation", "Testing", "Documentation", "Integration", "Error Handling", 
          "Refactoring", "Validation", "Configuration"].includes(st.title))
      );
      
      // If more than half the subtasks are generic, mark for retry
      if (dummySubtasks.length > Math.floor(task.subtasks.length / 2)) {
        tasksNeedingRetry.push({
          id: task.id,
          title: task.title,
          dummyCount: dummySubtasks.length,
          totalCount: task.subtasks.length
        });
      }
    }
    
    // If we found tasks with poor subtask quality, offer to retry them
    if (tasksNeedingRetry.length > 0) {
      console.log(chalk.yellow(`\nFound ${tasksNeedingRetry.length} tasks with low-quality subtasks that need retry:`));
      
      for (const task of tasksNeedingRetry) {
        console.log(chalk.yellow(`  Task ${task.id}: ${task.title} (${task.dummyCount}/${task.totalCount} generic subtasks)`));
      }
      
      // Ask user if they want to retry these tasks
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question(chalk.cyan('\nWould you like to retry expanding these tasks with enhanced prompts? (y/n): '), resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log(chalk.blue('\nRetrying task expansion with enhanced prompts...'));
        
        // For each task needing retry, we'll expand it again with a modified prompt
        let retryCount = 0;
        for (const task of tasksNeedingRetry) {
          console.log(chalk.blue(`\nRetrying expansion for task ${task.id}...`));
          
          // Enhanced context to encourage better subtask generation
          const enhancedContext = `${additionalContext ? additionalContext + "\n\n" : ""}
IMPORTANT: The previous expansion attempt generated mostly generic subtasks. Please provide highly specific, 
detailed, and technically relevant subtasks for this task. Each subtask should be:
1. Specifically related to the task at hand, not generic
2. Technically detailed with clear implementation guidance
3. Unique and addressing a distinct aspect of the parent task
          
Be creative and thorough in your analysis. The subtasks should collectively represent a complete solution to the parent task.`;
          
          // Try with different settings - if research was off, turn it on, or increase subtasks slightly
          const retryResearch = useResearch ? true : !useResearch; // Try opposite of current setting, but prefer ON
          const retrySubtasks = numSubtasks < 6 ? numSubtasks + 1 : numSubtasks; // Increase subtasks slightly if not already high
          
          // Delete existing subtasks for this task before regenerating
          const currentTaskData = readJSON(path.join(process.cwd(), 'tasks', 'tasks.json'));
          const taskToUpdate = currentTaskData.tasks.find(t => t.id === task.id);
          if (taskToUpdate) {
            taskToUpdate.subtasks = []; // Clear existing subtasks
            // Save before expanding again
            fs.writeFileSync(
              path.join(process.cwd(), 'tasks', 'tasks.json'),
              JSON.stringify(currentTaskData, null, 2)
            );
          }
          
          // Try expansion again with enhanced context and possibly different settings
          await expandTask(task.id, retrySubtasks, retryResearch, enhancedContext);
          retryCount++;
        }
        
        console.log(chalk.green(`\nCompleted retry expansion for ${retryCount} tasks.`));
        tasksExpanded += retryCount; // Add retries to total expanded count
      } else {
        console.log(chalk.blue('\nSkipping retry. You can manually retry task expansion using the expand command.'));
      }
    } else {
      console.log(chalk.green('\nVerification complete. All subtasks appear to be of good quality.'));
    }
    
    console.log(chalk.green(`\nExpanded ${tasksExpanded} tasks.`));
    return tasksExpanded;
  } catch (error) {
    console.error(chalk.red('Error expanding all tasks:'), error);
    return 0;
  }
}

//
// Generate subtasks using Claude
//
async function generateSubtasks(task, numSubtasks, nextSubtaskId, additionalContext = '') {
  log('info', `Generating ${numSubtasks} subtasks for task: ${task.title}`);
  
  const existingSubtasksText = task.subtasks && task.subtasks.length > 0
    ? `\nExisting subtasks:\n${task.subtasks.map(st => `${st.id}. ${st.title}: ${st.description}`).join('\n')}`
    : '';
  
  const prompt = `
Task Title: ${task.title}
Task Description: ${task.description}
Task Details: ${task.details || ''}
${existingSubtasksText}
${additionalContext ? `\nAdditional Context: ${additionalContext}` : ''}

Please generate ${numSubtasks} detailed subtasks for this task. Each subtask should be specific, actionable, and help accomplish the main task. The subtasks should cover different aspects of the main task and provide clear guidance on implementation.

For each subtask, provide:
1. A concise title
2. A detailed description
3. Dependencies (if any)
4. Acceptance criteria

Format each subtask as follows:

Subtask ${nextSubtaskId}: [Title]
Description: [Detailed description]
Dependencies: [List any dependencies by ID, or "None" if there are no dependencies]
Acceptance Criteria: [List specific criteria that must be met for this subtask to be considered complete]

Then continue with Subtask ${nextSubtaskId + 1}, and so on.
`;

  log('info', "Calling Claude to generate subtasks...");
  
  // Start loading indicator
  const loadingIndicator = startLoadingIndicator("Waiting for Claude to generate subtasks...");
  
  let fullResponse = '';
  let streamingInterval = null;

  try {
    const stream = await anthropic.messages.create({
      max_tokens: CONFIG.maxTokens,
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      messages: [
        { 
          role: "user", 
          content: prompt 
        }
      ],
      system: "You are a helpful assistant that generates detailed subtasks for software development tasks. Your subtasks should be specific, actionable, and help accomplish the main task. Format each subtask with a title, description, dependencies, and acceptance criteria.",
      stream: true
    });
    
    // Update loading indicator to show streaming progress
    let dotCount = 0;
    streamingInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
      dotCount = (dotCount + 1) % 4;
    }, 500);
    
    // Process the stream
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        fullResponse += chunk.delta.text;
      }
    }
    
    clearInterval(streamingInterval);
    
    // Stop loading indicator
    stopLoadingIndicator(loadingIndicator);
    log('info', "Received complete response from Claude API!");
    
    // Log the first part of the response for debugging
    log('debug', "Response preview:", fullResponse.substring(0, 200) + "...");
    
    // Parse the subtasks from the text response
    const subtasks = parseSubtasksFromText(fullResponse, nextSubtaskId, numSubtasks, task.id);
    
    return subtasks;
  } catch (error) {
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    log('error', "Error during streaming response:", error);
    throw error;
  }
}

//
// Parse subtasks from Claude's text response
//
function parseSubtasksFromText(text, startId, expectedCount, parentTaskId) {
  log('info', "Parsing subtasks from Claude's response...");
  
  const subtasks = [];
  
  // Enhanced regex that's more tolerant of variations in formatting
  // This handles more cases like: subtask headings with or without numbers, different separators, etc.
  const subtaskRegex = /(?:^|\n)\s*(?:(?:Subtask\s*(?:\d+)?[:.-]?\s*)|(?:\d+\.\s*))([^\n]+)(?:\n|$)(?:(?:\n|^)Description\s*[:.-]?\s*([^]*?))?(?:(?:\n|^)Dependencies\s*[:.-]?\s*([^]*?))?(?:(?:\n|^)Acceptance Criteria\s*[:.-]?\s*([^]*?))?(?=\n\s*(?:(?:Subtask\s*(?:\d+)?[:.-]?\s*)|(?:\d+\.\s*))|$)/gmi;
  
  let match;
  while ((match = subtaskRegex.exec(text)) !== null) {
    const [_, title, descriptionRaw, dependenciesRaw, acceptanceCriteriaRaw] = match;
    
    // Skip if we couldn't extract a meaningful title
    if (!title || title.trim().length === 0) continue;
    
    // Clean up the description - if description is undefined, use the first paragraph of the section
    let description = descriptionRaw ? descriptionRaw.trim() : '';
    if (!description) {
      // Try to extract the first paragraph after the title as the description
      const sectionText = text.substring(match.index + match[0].indexOf(title) + title.length);
      const nextSection = sectionText.match(/\n\s*(?:Subtask|Dependencies|Acceptance Criteria)/i);
      if (nextSection) {
        description = sectionText.substring(0, nextSection.index).trim();
      }
    }
    
    // Extract dependencies
    let dependencies = [];
    if (dependenciesRaw) {
      const depText = dependenciesRaw.trim();
      if (depText && !/(none|n\/a|no dependencies)/i.test(depText)) {
        // Extract numbers and subtask IDs (like 1.2) from dependencies text
        const depMatches = depText.match(/\d+(?:\.\d+)?/g);
        if (depMatches) {
          dependencies = depMatches.map(dep => {
            // Check if it's a subtask ID (contains a dot)
            if (dep.includes('.')) {
              return dep; // Keep as string for subtask IDs
            } else {
              // Try to parse as number
              const numDep = parseInt(dep, 10);
              // Small numbers (likely 1-9) are probably subtask IDs within the current task
              // This is a heuristic - when Claude says "Depends on subtask 1", 
              // it likely means subtask 1 of the current task
              if (numDep < 10) {
                // This is likely a subtask number - leave as number for the generateTaskFiles function 
                // to format correctly with the parent task ID
                return numDep;
              } else {
                // Larger numbers are probably full task IDs
                return numDep;
              }
            }
          });
          
          // Filter out any potential self-dependencies
          // The subtask ID is not yet fully formed at this point, but we can check if 
          // a string dependency matches the expected pattern of parent.currentSubtaskId
          const currentSubtaskId = startId + subtasks.length;
          dependencies = dependencies.filter(dep => {
            // Handle string dependencies in format "parentId.subtaskId"
            if (typeof dep === 'string' && dep.includes('.')) {
              // Check if the dependency points to this subtask itself
              if (dep === `${parentTaskId}.${currentSubtaskId}`) {
                log('warn', `Removing self-dependency from subtask ${parentTaskId}.${currentSubtaskId}`);
                return false;
              }
            }
            // Handle numeric dependencies that could become self-dependencies
            else if (typeof dep === 'number' && dep === currentSubtaskId) {
              log('warn', `Removing self-dependency from subtask ${parentTaskId}.${currentSubtaskId}`);
              return false;
            }
            return true;
          });
        }
      }
    }
    
    // Log for debugging
    log('debug', `Parsed dependencies: ${JSON.stringify(dependencies)}`);
    
    // Extract acceptance criteria
    let acceptanceCriteria = '';
    if (acceptanceCriteriaRaw) {
      acceptanceCriteria = acceptanceCriteriaRaw.trim();
    } else {
      // Try to find acceptance criteria in the section if not explicitly labeled
      const acMatch = match[0].match(/(?:criteria|must|should|requirements|tests)(?:\s*[:.-])?\s*([^]*?)(?=\n\s*(?:Subtask|Dependencies)|$)/i);
      if (acMatch) {
        acceptanceCriteria = acMatch[1].trim();
      }
    }
    
    // Create the subtask object
    const subtask = {
      id: startId + subtasks.length,
      title: title.trim(),
      description: description || `Implement ${title.trim()}`, // Ensure we have at least a basic description
      status: "pending",
      dependencies: dependencies,
      acceptanceCriteria: acceptanceCriteria
    };
    
    subtasks.push(subtask);
    
    // Break if we've found the expected number of subtasks
    if (subtasks.length >= expectedCount) {
      break;
    }
  }
  
  // If regex parsing failed or didn't find enough subtasks, try additional parsing methods
  if (subtasks.length < expectedCount) {
    log('info', `Regex parsing found only ${subtasks.length} subtasks, trying alternative parsing...`);
    
    // Look for numbered lists (1. Task title)
    const numberedListRegex = /(?:^|\n)\s*(\d+)\.\s+([^\n]+)(?:\n|$)([^]*?)(?=(?:\n\s*\d+\.\s+)|$)/g;
    while (subtasks.length < expectedCount && (match = numberedListRegex.exec(text)) !== null) {
      const [_, num, title, detailsRaw] = match;
      
      // Skip if we've already captured this (might be duplicated by the first regex)
      if (subtasks.some(st => st.title.trim() === title.trim())) {
        continue;
      }
      
      const details = detailsRaw ? detailsRaw.trim() : '';
      
      // Create the subtask
      const subtask = {
        id: startId + subtasks.length,
        title: title.trim(),
        description: details || `Implement ${title.trim()}`,
        status: "pending",
        dependencies: [],
        acceptanceCriteria: ''
      };
      
      subtasks.push(subtask);
    }
    
    // Look for bulleted lists (- Task title or * Task title)
    const bulletedListRegex = /(?:^|\n)\s*[-*]\s+([^\n]+)(?:\n|$)([^]*?)(?=(?:\n\s*[-*]\s+)|$)/g;
    while (subtasks.length < expectedCount && (match = bulletedListRegex.exec(text)) !== null) {
      const [_, title, detailsRaw] = match;
      
      // Skip if we've already captured this
      if (subtasks.some(st => st.title.trim() === title.trim())) {
        continue;
      }
      
      const details = detailsRaw ? detailsRaw.trim() : '';
      
      // Create the subtask
      const subtask = {
        id: startId + subtasks.length,
        title: title.trim(),
        description: details || `Implement ${title.trim()}`,
        status: "pending",
        dependencies: [],
        acceptanceCriteria: ''
      };
      
      subtasks.push(subtask);
    }
    
    // As a last resort, look for potential titles using heuristics (e.g., sentences followed by paragraphs)
    if (subtasks.length < expectedCount) {
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      
      for (let i = 0; i < lines.length && subtasks.length < expectedCount; i++) {
        const line = lines[i].trim();
        
        // Skip if the line is too long to be a title, or contains typical non-title content
        if (line.length > 100 || /^(Description|Dependencies|Acceptance Criteria|Implementation|Details|Approach):/i.test(line)) {
          continue;
        }
        
        // Skip if it matches a pattern we already tried to parse
        if (/^(Subtask|Task|\d+\.|-|\*)/.test(line)) {
          continue;
        }
        
        // Skip if we've already captured this title
        if (subtasks.some(st => st.title.trim() === line.trim())) {
          continue;
        }
        
        // Get the next few lines as potential description
        let description = '';
        if (i + 1 < lines.length) {
          description = lines.slice(i + 1, i + 4).join('\n').trim();
        }
        
        // Create the subtask
        const subtask = {
          id: startId + subtasks.length,
          title: line,
          description: description || `Implement ${line}`,
          status: "pending",
          dependencies: [],
          acceptanceCriteria: ''
        };
        
        subtasks.push(subtask);
      }
    }
  }
  
  // If we still don't have enough subtasks, create more meaningful dummy ones based on context
  if (subtasks.length < expectedCount) {
    log('info', `Parsing found only ${subtasks.length} subtasks, creating intelligent dummy ones to reach ${expectedCount}...`);
    
    // Create a list of common subtask patterns to use
    const dummyTaskPatterns = [
      { title: "Implementation", description: "Implement the core functionality required for this task." },
      { title: "Testing", description: "Create comprehensive tests for the implemented functionality." },
      { title: "Documentation", description: "Document the implemented functionality and usage examples." },
      { title: "Integration", description: "Integrate the functionality with other components of the system." },
      { title: "Error Handling", description: "Implement robust error handling and edge case management." },
      { title: "Refactoring", description: "Refine and optimize the implementation for better performance and maintainability." },
      { title: "Validation", description: "Implement validation logic to ensure data integrity and security." },
      { title: "Configuration", description: "Create configuration options and settings for the functionality." }
    ];
    
    for (let i = subtasks.length; i < expectedCount; i++) {
      // Select a pattern based on the current subtask number
      const patternIndex = i % dummyTaskPatterns.length;
      const pattern = dummyTaskPatterns[patternIndex];
      
      subtasks.push({
        id: startId + i,
        title: pattern.title,
        description: pattern.description,
        status: "pending",
        dependencies: [],
        acceptanceCriteria: 'Update this auto-generated subtask with specific details relevant to the parent task.'
      });
    }
  }
  
  log('info', `Successfully parsed ${subtasks.length} subtasks.`);
  return subtasks;
}

/**
 * Generate subtasks for a task using Perplexity AI with research capabilities
 * @param {Object} task - The task to generate subtasks for
 * @param {number} numSubtasks - The number of subtasks to generate
 * @param {number} nextSubtaskId - The ID to start assigning to subtasks
 * @returns {Promise<Array>} - The generated subtasks
 */
async function generateSubtasksWithPerplexity(task, numSubtasks = 3, nextSubtaskId = 1, additionalContext = '') {
  const { title, description, details = '', subtasks = [] } = task;
  
  console.log(chalk.blue(`Generating ${numSubtasks} subtasks for task: ${title}`));
  if (subtasks.length > 0) {
    console.log(chalk.yellow(`Task already has ${subtasks.length} subtasks. Adding ${numSubtasks} more.`));
  }

  // Get the tasks.json content for context
  let tasksData = {};
  try {
    tasksData = readJSON(path.join(process.cwd(), 'tasks', 'tasks.json'));
  } catch (error) {
    console.log(chalk.yellow('Could not read tasks.json for context. Proceeding without it.'));
  }

  // Get the PRD content for context if available
  let prdContent = '';
  if (tasksData.meta && tasksData.meta.source) {
    try {
      prdContent = fs.readFileSync(path.join(process.cwd(), tasksData.meta.source), 'utf8');
      console.log(chalk.green(`Successfully loaded PRD from ${tasksData.meta.source} (${prdContent.length} characters)`));
    } catch (error) {
      console.log(chalk.yellow(`Could not read PRD at ${tasksData.meta.source}. Proceeding without it.`));
    }
  }

  // Get the specific task file for more detailed context if available
  let taskFileContent = '';
  try {
    const taskFileName = `task_${String(task.id).padStart(3, '0')}.txt`;
    const taskFilePath = path.join(process.cwd(), 'tasks', taskFileName);
    if (fs.existsSync(taskFilePath)) {
      taskFileContent = fs.readFileSync(taskFilePath, 'utf8');
      console.log(chalk.green(`Successfully loaded task file ${taskFileName} for additional context`));
    }
  } catch (error) {
    console.log(chalk.yellow(`Could not read task file for task ${task.id}. Proceeding without it.`));
  }

  // Get dependency task details for better context
  let dependencyDetails = '';
  if (task.dependencies && task.dependencies.length > 0) {
    dependencyDetails = 'Dependency Tasks:\n';
    for (const depId of task.dependencies) {
      const depTask = tasksData.tasks.find(t => t.id === depId);
      if (depTask) {
        dependencyDetails += `Task ${depId}: ${depTask.title}\n`;
        dependencyDetails += `Description: ${depTask.description}\n`;
        if (depTask.details) {
          dependencyDetails += `Details: ${depTask.details.substring(0, 200)}${depTask.details.length > 200 ? '...' : ''}\n`;
        }
        dependencyDetails += '\n';
      }
    }
  }

  // Extract project metadata for context
  const projectContext = tasksData.meta ? 
    `Project: ${tasksData.meta.projectName || 'Unknown'}
Version: ${tasksData.meta.version || '1.0.0'}
Description: ${tasksData.meta.description || 'No description available'}` : '';

  // Construct the prompt for Perplexity/Anthropic with enhanced context
  const prompt = `I need to break down the following task into ${numSubtasks} detailed subtasks for a software development project.

${projectContext}

CURRENT TASK:
Task ID: ${task.id}
Task Title: ${title}
Task Description: ${description}
Priority: ${task.priority || 'medium'}
Additional Details: ${details}
${additionalContext ? `\nADDITIONAL CONTEXT PROVIDED BY USER:\n${additionalContext}` : ''}

${taskFileContent ? `DETAILED TASK INFORMATION:
${taskFileContent}` : ''}

${dependencyDetails ? dependencyDetails : ''}

${subtasks.length > 0 ? `Existing Subtasks:
${subtasks.map(st => `- ${st.title}: ${st.description}`).join('\n')}` : ''}

${prdContent ? `PRODUCT REQUIREMENTS DOCUMENT:
${prdContent}` : ''}

${tasksData.tasks ? `PROJECT CONTEXT - OTHER RELATED TASKS:
${JSON.stringify(
  tasksData.tasks
    .filter(t => t.id !== task.id)
    // Prioritize tasks that are dependencies or depend on this task
    .sort((a, b) => {
      const aIsRelated = task.dependencies?.includes(a.id) || a.dependencies?.includes(task.id);
      const bIsRelated = task.dependencies?.includes(b.id) || b.dependencies?.includes(task.id);
      return bIsRelated - aIsRelated;
    })
    .slice(0, 5) // Limit to 5 most relevant tasks to avoid context overload
    .map(t => ({ 
      id: t.id, 
      title: t.title, 
      description: t.description,
      status: t.status,
      dependencies: t.dependencies
    })), 
  null, 2
)}` : ''}

Please generate ${numSubtasks} subtasks that are:
1. Specific and actionable
2. Relevant to the current technology stack and project requirements
3. Properly sequenced with clear dependencies
4. Detailed enough to be implemented without further clarification

For each subtask, provide:
1. A clear, concise title
2. A detailed description explaining what needs to be done
3. Dependencies (if any) - list the IDs of tasks this subtask depends on
4. Acceptance criteria - specific conditions that must be met for the subtask to be considered complete

Format each subtask as follows:

Subtask 1: [Title]
Description: [Detailed description]
Dependencies: [List of task IDs, or "None" if no dependencies]
Acceptance Criteria: [List of criteria]

Subtask 2: [Title]
...

Research the task thoroughly and ensure the subtasks are comprehensive, specific, and actionable. Focus on technical implementation details rather than generic steps.`;

  // Define the research prompt for Perplexity
  const researchPrompt = `You are a software development expert tasked with breaking down complex development tasks into detailed subtasks. Please research the following task thoroughly, and generate ${numSubtasks} specific, actionable subtasks.

${prompt}

Format your response as specific, well-defined subtasks that could be assigned to developers. Be precise and technical in your descriptions.`;

  // Start loading indicator
  const loadingInterval = startLoadingIndicator('Researching and generating subtasks with AI');

  try {
    let responseText;
    
    try {
      // Try to use Perplexity first
      console.log(chalk.blue('Using Perplexity AI for research-backed subtask generation...'));
      const result = await getPerplexityClient().chat.completions.create({
        model: PERPLEXITY_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a technical analysis AI that helps break down software development tasks into detailed subtasks. Provide specific, actionable steps with clear definitions."
          },
          {
            role: "user",
            content: researchPrompt
          }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      });
      
      // Extract the response text
      responseText = result.choices[0].message.content;
      console.log(chalk.green('Successfully generated subtasks with Perplexity AI'));
    } catch (perplexityError) {
      console.log(chalk.yellow('Falling back to Anthropic for subtask generation...'));
      console.log(chalk.gray('Perplexity error:'), perplexityError.message);
      
      // Use Anthropic as fallback
      const stream = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: "You are an expert software developer and project manager. Your task is to break down software development tasks into detailed subtasks that are specific, actionable, and technically relevant.",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        stream: true
      });
      
      // Process the stream
      responseText = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
          responseText += chunk.delta.text;
        }
      }
      
      console.log(chalk.green('Successfully generated subtasks with Anthropic AI'));
    }

    // Stop loading indicator
    stopLoadingIndicator(loadingInterval);
    
    if (CONFIG.debug) {
      console.log(chalk.gray('AI Response:'));
      console.log(chalk.gray(responseText));
    }
    
    // Parse the subtasks from the response text
    const subtasks = parseSubtasksFromText(responseText, nextSubtaskId, numSubtasks, task.id);
    return subtasks;
  } catch (error) {
    stopLoadingIndicator(loadingInterval);
    console.error(chalk.red('Error generating subtasks:'), error);
    throw error;
  }
}

// ------------------------------------------
// Main CLI
// ------------------------------------------
async function main() {
  // Add custom help
  program.on('--help', function() {
    displayHelp();
  });
  
  if (process.argv.length <= 2) {
    displayHelp();
    process.exit(0);
  }
  
  program
    .name('dev')
    .description('AI-driven development task management')
    .version(() => {
      // Read version directly from package.json
      try {
        const packageJsonPath = path.join(__dirname, '..', 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          return packageJson.version;
        }
      } catch (error) {
        // Silently fall back to default version
      }
      return "1.5.0"; // Default fallback
    });

  program
    .command('parse-prd')
    .description('Parse a PRD file and generate tasks')
    .argument('<file>', 'Path to the PRD file')
    .option('-o, --output <file>', 'Output file path', 'tasks/tasks.json')
    .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
    .action(async (file, options) => {
      const numTasks = parseInt(options.numTasks, 10);
      const outputPath = options.output;
      
      console.log(chalk.blue(`Parsing PRD file: ${file}`));
      console.log(chalk.blue(`Generating ${numTasks} tasks...`));
      
      await parsePRD(file, outputPath, numTasks);
    });

  program
    .command('update')
    .description('Update tasks based on new information or implementation changes')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('--from <id>', 'Task ID to start updating from (tasks with ID >= this value will be updated)', '1')
    .option('-p, --prompt <text>', 'Prompt explaining the changes or new context (required)')
    .action(async (options) => {
      const tasksPath = options.file;
      const fromId = parseInt(options.from, 10);
      const prompt = options.prompt;
      
      if (!prompt) {
        console.error(chalk.red('Error: --prompt parameter is required. Please provide information about the changes.'));
        process.exit(1);
      }
      
      console.log(chalk.blue(`Updating tasks from ID >= ${fromId} with prompt: "${prompt}"`));
      console.log(chalk.blue(`Tasks file: ${tasksPath}`));
      
      await updateTasks(tasksPath, fromId, prompt);
    });

  program
    .command('generate')
    .description('Generate task files from tasks.json')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-o, --output <dir>', 'Output directory', 'tasks')
    .action(async (options) => {
      const tasksPath = options.file;
      const outputDir = options.output;
      
      console.log(chalk.blue(`Generating task files from: ${tasksPath}`));
      console.log(chalk.blue(`Output directory: ${outputDir}`));
      
      await generateTaskFiles(tasksPath, outputDir);
    });

  program
    .command('set-status')
    .description('Set the status of a task')
    .option('-i, --id <id>', 'Task ID (can be comma-separated for multiple tasks)')
    .option('-s, --status <status>', 'New status (todo, in-progress, review, done)')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      const tasksPath = options.file;
      const taskId = options.id;
      const status = options.status;
      
      if (!taskId || !status) {
        console.error(chalk.red('Error: Both --id and --status are required'));
        process.exit(1);
      }
      
      console.log(chalk.blue(`Setting status of task(s) ${taskId} to: ${status}`));
      
      await setTaskStatus(tasksPath, taskId, status);
    });

  program
    .command('list')
    .description('List all tasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-s, --status <status>', 'Filter by status')
    .option('--with-subtasks', 'Show subtasks for each task')
    .action(async (options) => {
      const tasksPath = options.file;
      const statusFilter = options.status;
      const withSubtasks = options.withSubtasks || false;
      
      console.log(chalk.blue(`Listing tasks from: ${tasksPath}`));
      if (statusFilter) {
        console.log(chalk.blue(`Filtering by status: ${statusFilter}`));
      }
      if (withSubtasks) {
        console.log(chalk.blue('Including subtasks in listing'));
      }
      
      await listTasks(tasksPath, statusFilter, withSubtasks);
    });

  program
    .command('expand')
    .description('Expand tasks with subtasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'Task ID to expand')
    .option('-a, --all', 'Expand all tasks')
    .option('-n, --num <number>', 'Number of subtasks to generate', CONFIG.defaultSubtasks.toString())
    .option('-r, --no-research', 'Disable Perplexity AI for research-backed subtask generation')
    .option('-p, --prompt <text>', 'Additional context to guide subtask generation')
    .option('--force', 'Force regeneration of subtasks for tasks that already have them')
    .action(async (options) => {
      const tasksPath = options.file;
      const idArg = options.id ? parseInt(options.id, 10) : null;
      const allFlag = options.all;
      const numSubtasks = parseInt(options.num, 10);
      const forceFlag = options.force;
      // Fix: The issue is here - research should be false when --no-research is specified
      // This will correctly check if research is false
      const useResearch = options.research === true;
      // Debug log to verify the value
      console.log(`Debug - options.research value: ${options.research}`);
      const additionalContext = options.prompt || '';
      
      if (allFlag) {
        console.log(chalk.blue(`Expanding all tasks with ${numSubtasks} subtasks each...`));
        if (useResearch) {
          console.log(chalk.blue('Using Perplexity AI for research-backed subtask generation'));
        } else {
          console.log(chalk.yellow('Research-backed subtask generation disabled'));
        }
        if (additionalContext) {
          console.log(chalk.blue(`Additional context: "${additionalContext}"`));
        }
        await expandAllTasks(numSubtasks, useResearch, additionalContext, forceFlag);
      } else if (idArg) {
        console.log(chalk.blue(`Expanding task ${idArg} with ${numSubtasks} subtasks...`));
        if (useResearch) {
          console.log(chalk.blue('Using Perplexity AI for research-backed subtask generation'));
        } else {
          console.log(chalk.yellow('Research-backed subtask generation disabled'));
        }
        if (additionalContext) {
          console.log(chalk.blue(`Additional context: "${additionalContext}"`));
        }
        await expandTask(idArg, numSubtasks, useResearch, additionalContext);
      } else {
        console.error(chalk.red('Error: Please specify a task ID with --id=<id> or use --all to expand all tasks.'));
      }
    });

  program
    .command('analyze-complexity')
    .description('Analyze tasks and generate complexity-based expansion recommendations')
    .option('-o, --output <file>', 'Output file path for the report', 'scripts/task-complexity-report.json')
    .option('-m, --model <model>', 'LLM model to use for analysis (defaults to configured model)')
    .option('-t, --threshold <number>', 'Minimum complexity score to recommend expansion (1-10)', '5')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-r, --research', 'Use Perplexity AI for research-backed complexity analysis')
    .action(async (options) => {
      const tasksPath = options.file || 'tasks/tasks.json';
      const outputPath = options.output;
      const modelOverride = options.model;
      const thresholdScore = parseFloat(options.threshold);
      const useResearch = options.research || false;
      
      console.log(chalk.blue(`Analyzing task complexity from: ${tasksPath}`));
      console.log(chalk.blue(`Output report will be saved to: ${outputPath}`));
      
      if (useResearch) {
        console.log(chalk.blue('Using Perplexity AI for research-backed complexity analysis'));
      }
      
      await analyzeTaskComplexity(options);
    });

  program
    .command('clear-subtasks')
    .description('Clear subtasks from specified tasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <ids>', 'Task IDs (comma-separated) to clear subtasks from')
    .option('--all', 'Clear subtasks from all tasks')
    .action(async (options) => {
      const tasksPath = options.file;
      const taskIds = options.id;
      const all = options.all;

      if (!taskIds && !all) {
        console.error(chalk.red('Error: Please specify task IDs with --id=<ids> or use --all to clear all tasks'));
        process.exit(1);
      }

      if (all) {
        // If --all is specified, get all task IDs
        const data = readJSON(tasksPath);
        if (!data || !data.tasks) {
          console.error(chalk.red('Error: No valid tasks found'));
          process.exit(1);
        }
        const allIds = data.tasks.map(t => t.id).join(',');
        clearSubtasks(tasksPath, allIds);
      } else {
        clearSubtasks(tasksPath, taskIds);
      }
    });

  program
    .command('add-task')
    .description('Add a new task to tasks.json using AI')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-p, --prompt <text>', 'Description of the task to add (required)')
    .option('-d, --dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
    .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
    .action(async (options) => {
      const tasksPath = options.file;
      const prompt = options.prompt;
      const dependencies = options.dependencies ? options.dependencies.split(',').map(id => parseInt(id.trim(), 10)) : [];
      const priority = options.priority;
      
      if (!prompt) {
        console.error(chalk.red('Error: --prompt parameter is required. Please provide a description of the task.'));
    process.exit(1);
      }
      
      console.log(chalk.blue(`Adding new task with prompt: "${prompt}"`));
      console.log(chalk.blue(`Tasks file: ${tasksPath}`));
      
      await addTask(tasksPath, prompt, dependencies, priority);
    });

  program
    .command('next')
    .description('Show the next task to work on based on dependencies and status')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      const tasksPath = options.file;
      await displayNextTask(tasksPath);
    });

  program
    .command('show')
    .description('Show details of a specific task by ID')
    .argument('[id]', 'Task ID to show')
    .option('-i, --id <id>', 'Task ID to show (alternative to argument)')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (id, options) => {
      const taskId = id || options.id;
      
      if (!taskId) {
        console.error(chalk.red('Error: Task ID is required. Provide it as an argument or with --id option.'));
        console.error(chalk.yellow('Examples:'));
        console.error(chalk.yellow('  node scripts/dev.js show 1'));
        console.error(chalk.yellow('  node scripts/dev.js show --id=1'));
        process.exit(1);
      }
      
      const tasksPath = options.file;
      await displayTaskById(tasksPath, taskId);
    });

  program
    .command('add-dependency')
    .description('Add a dependency to a task')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'ID of the task to add dependency to')
    .option('-d, --depends-on <id>', 'ID of the task to add as dependency')
    .action(async (options) => {
      const tasksPath = options.file;
      const taskId = options.id;
      const dependencyId = options.dependsOn;
      
      if (!taskId || !dependencyId) {
        console.error(chalk.red('Error: Both --id and --depends-on parameters are required.'));
        console.error(chalk.yellow('Example:'));
        console.error(chalk.yellow('  node scripts/dev.js add-dependency --id=22 --depends-on=21'));
        process.exit(1);
      }
      
      await addDependency(tasksPath, taskId, dependencyId);
    });

  program
    .command('remove-dependency')
    .description('Remove a dependency from a task')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-i, --id <id>', 'ID of the task to remove dependency from')
    .option('-d, --depends-on <id>', 'ID of the task to remove as dependency')
    .action(async (options) => {
      const tasksPath = options.file;
      const taskId = options.id;
      const dependencyId = options.dependsOn;
      
      if (!taskId || !dependencyId) {
        console.error(chalk.red('Error: Both --id and --depends-on parameters are required.'));
        console.error(chalk.yellow('Example:'));
        console.error(chalk.yellow('  node scripts/dev.js remove-dependency --id=22 --depends-on=21'));
        process.exit(1);
      }
      
      await removeDependency(tasksPath, taskId, dependencyId);
    });

  program
    .command('validate-dependencies')
    .description('Check for and remove invalid dependencies from tasks')
    .option('-f, --file <path>', 'Path to the tasks.json file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        await validateDependenciesCommand(options.file);
      } catch (error) {
        log('error', "Error in validate-dependencies command:", error);
        process.exit(1);
      }
    });

  program
    .command('fix-dependencies')
    .description('Find and fix all invalid dependencies in tasks.json and task files')
    .option('-f, --file <path>', 'Path to the tasks.json file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        await fixDependenciesCommand(options.file);
      } catch (error) {
        log('error', "Error in fix-dependencies command:", error);
        process.exit(1);
      }
    });

  program
    .command('complexity-report')
    .description('Display the complexity analysis report')
    .option('-f, --file <path>', 'Path to the complexity report file', 'scripts/task-complexity-report.json')
    .action(async (options) => {
      const reportPath = options.file;
      await displayComplexityReport(reportPath);
    });

  program
    .command('*')
    .description('Handle unknown commands')
    .action(async (command) => {
      console.error(chalk.red(`Unknown command: ${command}`));
      displayHelp();
      process.exit(1);
    });

  await program.parseAsync(process.argv);
}

/**
 * Generates the prompt for the LLM to analyze task complexity
 * @param {Object} tasksData The tasks data from tasks.json
 * @returns {string} The prompt for the LLM
 */
function generateComplexityAnalysisPrompt(tasksData) {
  return `
You are an expert software architect and project manager. Your task is to analyze the complexity of development tasks and determine how many subtasks each should be broken down into.

Below is a list of development tasks with their descriptions and details. For each task:
1. Assess its complexity on a scale of 1-10
2. Recommend the optimal number of subtasks (between ${Math.max(3, CONFIG.defaultSubtasks - 1)}-${Math.min(8, CONFIG.defaultSubtasks + 2)})
3. Suggest a specific prompt that would help generate good subtasks for this task
4. Explain your reasoning briefly

Tasks:
${tasksData.tasks.map(task => `
ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details}
Dependencies: ${JSON.stringify(task.dependencies || [])}
Priority: ${task.priority || 'medium'}
`).join('\n---\n')}

Analyze each task and return a JSON array with the following structure for each task:
[
  {
    "taskId": number,
    "taskTitle": string,
    "complexityScore": number (1-10),
    "recommendedSubtasks": number (${Math.max(3, CONFIG.defaultSubtasks - 1)}-${Math.min(8, CONFIG.defaultSubtasks + 2)}),
    "expansionPrompt": string (a specific prompt for generating good subtasks),
    "reasoning": string (brief explanation of your assessment)
  },
  ...
]

IMPORTANT: Make sure to include an analysis for EVERY task listed above, with the correct taskId matching each task's ID.
`;
}

/**
 * Sanitizes a prompt string for use in a shell command
 * @param {string} prompt The prompt to sanitize
 * @returns {string} Sanitized prompt
 */
function sanitizePrompt(prompt) {
  // Replace double quotes with escaped double quotes
  return prompt.replace(/"/g, '\\"');
}

/**
 * Reads and parses the complexity report if it exists
 * @param {string} customPath - Optional custom path to the report
 * @returns {Object|null} The parsed complexity report or null if not found
 */
function readComplexityReport(customPath = null) {
  try {
    const reportPath = customPath || path.join(process.cwd(), 'scripts', 'task-complexity-report.json');
    if (!fs.existsSync(reportPath)) {
      return null;
    }
    
    const reportData = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(reportData);
  } catch (error) {
    console.log(chalk.yellow(`Could not read complexity report: ${error.message}`));
    return null;
  }
}

/**
 * Finds a task analysis in the complexity report
 * @param {Object} report - The complexity report
 * @param {number} taskId - The task ID to find
 * @returns {Object|null} The task analysis or null if not found
 */
function findTaskInComplexityReport(report, taskId) {
  if (!report || !report.complexityAnalysis || !Array.isArray(report.complexityAnalysis)) {
    return null;
  }
  
  return report.complexityAnalysis.find(task => task.taskId === taskId);
}

//
// Clear subtasks from tasks
//
function clearSubtasks(tasksPath, taskIds) {
  displayBanner();
  
  log('info', `Reading tasks from ${tasksPath}...`);
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks found.");
    process.exit(1);
  }

  console.log(boxen(
    chalk.white.bold('Clearing Subtasks'), 
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));

  // Handle multiple task IDs (comma-separated)
  const taskIdArray = taskIds.split(',').map(id => id.trim());
  let clearedCount = 0;
  
  // Create a summary table for the cleared subtasks
  const summaryTable = new Table({
    head: [
      chalk.cyan.bold('Task ID'), 
      chalk.cyan.bold('Task Title'), 
      chalk.cyan.bold('Subtasks Cleared')
    ],
    colWidths: [10, 50, 20],
    style: { head: [], border: [] }
  });

  taskIdArray.forEach(taskId => {
    const id = parseInt(taskId, 10);
    if (isNaN(id)) {
      log('error', `Invalid task ID: ${taskId}`);
      return;
    }

    const task = data.tasks.find(t => t.id === id);
    if (!task) {
      log('error', `Task ${id} not found`);
      return;
    }

    if (!task.subtasks || task.subtasks.length === 0) {
      log('info', `Task ${id} has no subtasks to clear`);
      summaryTable.push([
        id.toString(),
        truncate(task.title, 47),
        chalk.yellow('No subtasks')
      ]);
      return;
    }

    const subtaskCount = task.subtasks.length;
    task.subtasks = [];
    clearedCount++;
    log('info', `Cleared ${subtaskCount} subtasks from task ${id}`);
    
    summaryTable.push([
      id.toString(),
      truncate(task.title, 47),
      chalk.green(`${subtaskCount} subtasks cleared`)
    ]);
  });

  if (clearedCount > 0) {
    writeJSON(tasksPath, data);
    
    // Show summary table
    console.log(boxen(
      chalk.white.bold('Subtask Clearing Summary:'),
      { padding: { left: 2, right: 2, top: 0, bottom: 0 }, margin: { top: 1, bottom: 0 }, borderColor: 'blue', borderStyle: 'round' }
    ));
    console.log(summaryTable.toString());
    
    // Regenerate task files to reflect changes
    log('info', "Regenerating task files...");
    generateTaskFiles(tasksPath, path.dirname(tasksPath));
    
    // Success message
    console.log(boxen(
      chalk.green(`Successfully cleared subtasks from ${chalk.bold(clearedCount)} task(s)`),
      { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    // Next steps suggestion
    console.log(boxen(
      chalk.white.bold('Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow('node scripts/dev.js expand --id=<id>')} to generate new subtasks\n` +
      `${chalk.cyan('2.')} Run ${chalk.yellow('node scripts/dev.js list --with-subtasks')} to verify changes`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
    ));
    
  } else {
    console.log(boxen(
      chalk.yellow('No subtasks were cleared'),
      { padding: 1, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
  }
}

// ----------------------------------------
// Custom help display
// ----------------------------------------
function displayHelp() {
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
          desc: 'Create individual task files from tasks.json' }
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
  
  console.log(chalk.cyan('  1. Generate tasks:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js parse-prd --input=prd.txt')}`);
  console.log(chalk.cyan('  2. Generate task files:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js generate')}`);
  console.log(chalk.cyan('  3. Analyze task complexity:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js analyze-complexity --research')}`);
  console.log(chalk.cyan('  4. Break down complex tasks:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js expand --id=3 --research')}`);
  console.log(chalk.cyan('  5. Track progress:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js list --with-subtasks')}`);
  console.log(chalk.cyan('  6. Update task status:'));
  console.log(`     ${chalk.yellow('node scripts/dev.js set-status --id=1 --status=done')}`);
  
  console.log('\n');
}

async function addTask(tasksPath, prompt, dependencies = [], priority = 'medium') {
  displayBanner();
  
  // Read the existing tasks
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "Invalid or missing tasks.json.");
    process.exit(1);
  }
  
  // Find the highest task ID to determine the next ID
  const highestId = Math.max(...data.tasks.map(t => t.id));
  const newTaskId = highestId + 1;
  
  console.log(boxen(
    chalk.white.bold(`Creating New Task #${newTaskId}`),
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));
  
  // Validate dependencies before proceeding
  const invalidDeps = dependencies.filter(depId => {
    return !data.tasks.some(t => t.id === depId);
  });
  
  if (invalidDeps.length > 0) {
    log('warn', `The following dependencies do not exist: ${invalidDeps.join(', ')}`);
    log('info', 'Removing invalid dependencies...');
    dependencies = dependencies.filter(depId => !invalidDeps.includes(depId));
  }
  
  // Create the system prompt for Claude
  const systemPrompt = "You are a helpful assistant that creates well-structured tasks for a software development project. Generate a single new task based on the user's description.";
  
  // Create the user prompt with context from existing tasks
  let contextTasks = '';
  if (dependencies.length > 0) {
    // Provide context for the dependent tasks
    const dependentTasks = data.tasks.filter(t => dependencies.includes(t.id));
    contextTasks = `\nThis task depends on the following tasks:\n${dependentTasks.map(t => 
      `- Task ${t.id}: ${t.title} - ${t.description}`).join('\n')}`;
  } else {
    // Provide a few recent tasks as context
    const recentTasks = [...data.tasks].sort((a, b) => b.id - a.id).slice(0, 3);
    contextTasks = `\nRecent tasks in the project:\n${recentTasks.map(t => 
      `- Task ${t.id}: ${t.title} - ${t.description}`).join('\n')}`;
  }
  
  const taskStructure = `
  {
    "title": "Task title goes here",
    "description": "A concise one or two sentence description of what the task involves",
    "details": "In-depth details including specifics on implementation, considerations, and anything important for the developer to know. This should be detailed enough to guide implementation.",
    "testStrategy": "A detailed approach for verifying the task has been correctly implemented. Include specific test cases or validation methods."
  }`;
  
  const userPrompt = `Create a comprehensive new task (Task #${newTaskId}) for a software development project based on this description: "${prompt}"
  
  ${contextTasks}
  
  Return your answer as a single JSON object with the following structure:
  ${taskStructure}
  
  Don't include the task ID, status, dependencies, or priority as those will be added automatically.
  Make sure the details and test strategy are thorough and specific.
  
  IMPORTANT: Return ONLY the JSON object, nothing else.`;
  
  // Start the loading indicator
  const loadingIndicator = startLoadingIndicator('Generating new task with Claude AI...');
  
  let fullResponse = '';
  let streamingInterval = null;

  try {
    // Call Claude with streaming enabled
    const stream = await anthropic.messages.create({
      max_tokens: CONFIG.maxTokens,
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
      stream: true
    });
    
    // Update loading indicator to show streaming progress
    let dotCount = 0;
    streamingInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
      dotCount = (dotCount + 1) % 4;
    }, 500);
    
    // Process the stream
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        fullResponse += chunk.delta.text;
      }
    }
    
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    log('info', "Completed streaming response from Claude API!");
    log('debug', `Streaming response length: ${fullResponse.length} characters`);
    
    // Parse the response - handle potential JSON formatting issues
    let taskData;
    try {
      // Check if the response is wrapped in a code block
      const jsonMatch = fullResponse.match(/```(?:json)?([^`]+)```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : fullResponse;
      
      // Parse the JSON
      taskData = JSON.parse(jsonContent);
      
      // Check that we have the required fields
      if (!taskData.title || !taskData.description) {
        throw new Error("Missing required fields in the generated task");
      }
    } catch (error) {
      log('error', "Failed to parse Claude's response as valid task JSON:", error);
      log('debug', "Response content:", fullResponse);
      process.exit(1);
    }
    
    // Create the new task object
    const newTask = {
      id: newTaskId,
      title: taskData.title,
      description: taskData.description,
      status: "pending",
      dependencies: dependencies,
      priority: priority,
      details: taskData.details || "",
      testStrategy: taskData.testStrategy || "Manually verify the implementation works as expected."
    };
    
    // Add the new task to the tasks array
    data.tasks.push(newTask);
    
    // Validate dependencies in the entire task set
    log('info', "Validating dependencies after adding new task...");
    const dependencyChanges = validateAndFixDependencies(data, null);
    if (dependencyChanges) {
      log('info', "Fixed some dependencies that became invalid after adding the new task");
    }
    
    // Write the updated tasks back to the file
    writeJSON(tasksPath, data);
    
    // Show success message
    const successBox = boxen(
      chalk.green(`Successfully added new task #${newTaskId}:\n`) +
      chalk.white.bold(newTask.title) + "\n\n" +
      chalk.white(newTask.description),
      { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    );
    console.log(successBox);
    
    // Next steps suggestion
    console.log(boxen(
      chalk.white.bold('Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow('node scripts/dev.js generate')} to update task files\n` +
      `${chalk.cyan('2.')} Run ${chalk.yellow('node scripts/dev.js expand --id=' + newTaskId)} to break it down into subtasks\n` +
      `${chalk.cyan('3.')} Run ${chalk.yellow('node scripts/dev.js list --with-subtasks')} to see all tasks`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    return newTaskId;
  } catch (error) {
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    log('error', "Error generating task:", error.message);
    process.exit(1);
  }
}

/**
 * Find the next pending task based on dependencies
 * @param {Object[]} tasks - The array of tasks
 * @returns {Object|null} The next task to work on or null if no eligible tasks
 */
function findNextTask(tasks) {
  // Get all completed task IDs
  const completedTaskIds = new Set(
    tasks
      .filter(t => t.status === 'done' || t.status === 'completed')
      .map(t => t.id)
  );
  
  // Filter for pending tasks whose dependencies are all satisfied
  const eligibleTasks = tasks.filter(task => 
    (task.status === 'pending' || task.status === 'in-progress') && 
    task.dependencies && // Make sure dependencies array exists
    task.dependencies.every(depId => completedTaskIds.has(depId))
  );
  
  if (eligibleTasks.length === 0) {
    return null;
  }
  
  // Sort eligible tasks by:
  // 1. Priority (high > medium > low)
  // 2. Dependencies count (fewer dependencies first)
  // 3. ID (lower ID first)
  const priorityValues = { 'high': 3, 'medium': 2, 'low': 1 };
  
  const nextTask = eligibleTasks.sort((a, b) => {
    // Sort by priority first
    const priorityA = priorityValues[a.priority || 'medium'] || 2;
    const priorityB = priorityValues[b.priority || 'medium'] || 2;
    
    if (priorityB !== priorityA) {
      return priorityB - priorityA; // Higher priority first
    }
    
    // If priority is the same, sort by dependency count
    if (a.dependencies && b.dependencies && a.dependencies.length !== b.dependencies.length) {
      return a.dependencies.length - b.dependencies.length; // Fewer dependencies first
    }
    
    // If dependency count is the same, sort by ID
    return a.id - b.id; // Lower ID first
  })[0]; // Return the first (highest priority) task
  
  return nextTask;
}

/**
 * Display the next task to work on
 * @param {string} tasksPath - Path to the tasks.json file
 */
async function displayNextTask(tasksPath) {
  displayBanner();
  
  // Read the tasks file
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks found.");
    process.exit(1);
  }
  
  // Find the next task
  const nextTask = findNextTask(data.tasks);
  
  if (!nextTask) {
    console.log(boxen(
      chalk.yellow('No eligible tasks found!\n\n') +
      'All pending tasks have unsatisfied dependencies, or all tasks are completed.',
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
    return;
  }
  
  // Display the task in a nice format
  console.log(boxen(
    chalk.white.bold(`Next Task: #${nextTask.id} - ${nextTask.title}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
  ));
  
  // Create a table with task details
  const taskTable = new Table({
    style: {
      head: [],
      border: [],
      'padding-top': 0,
      'padding-bottom': 0,
      compact: true
    },
    chars: {
      'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
    },
    colWidths: [15, 75]
  });
  
  // Priority with color
  const priorityColors = {
    'high': chalk.red.bold,
    'medium': chalk.yellow,
    'low': chalk.gray
  };
  const priorityColor = priorityColors[nextTask.priority || 'medium'] || chalk.white;
  
  // Add task details to table
  taskTable.push(
    [chalk.cyan.bold('ID:'), nextTask.id.toString()],
    [chalk.cyan.bold('Title:'), nextTask.title],
    [chalk.cyan.bold('Priority:'), priorityColor(nextTask.priority || 'medium')],
    [chalk.cyan.bold('Dependencies:'), formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true)],
    [chalk.cyan.bold('Description:'), nextTask.description]
  );
  
  console.log(taskTable.toString());
  
  // If task has details, show them in a separate box
  if (nextTask.details && nextTask.details.trim().length > 0) {
    console.log(boxen(
      chalk.white.bold('Implementation Details:') + '\n\n' + 
      nextTask.details,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show subtasks if they exist
  if (nextTask.subtasks && nextTask.subtasks.length > 0) {
    console.log(boxen(
      chalk.white.bold('Subtasks'),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, margin: { top: 1, bottom: 0 }, borderColor: 'magenta', borderStyle: 'round' }
    ));
    
    // Create a table for subtasks
    const subtaskTable = new Table({
      head: [
        chalk.magenta.bold('ID'), 
        chalk.magenta.bold('Status'), 
        chalk.magenta.bold('Title'),
        chalk.magenta.bold('Dependencies')
      ],
      colWidths: [6, 12, 50, 20],
      style: {
        head: [],
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      }
    });
    
    // Add subtasks to table
    nextTask.subtasks.forEach(st => {
      const statusColor = {
        'done': chalk.green,
        'completed': chalk.green,
        'pending': chalk.yellow,
        'in-progress': chalk.blue
      }[st.status || 'pending'] || chalk.white;
      
      // Format subtask dependencies
      let subtaskDeps = 'None';
      if (st.dependencies && st.dependencies.length > 0) {
        // Format dependencies with correct notation
        const formattedDeps = st.dependencies.map(depId => {
          if (typeof depId === 'number' && depId < 100) {
            return `${nextTask.id}.${depId}`;
          }
          return depId;
        });
        subtaskDeps = formatDependenciesWithStatus(formattedDeps, data.tasks, true);
      }
      
      subtaskTable.push([
        `${nextTask.id}.${st.id}`,
        statusColor(st.status || 'pending'),
        st.title,
        subtaskDeps
      ]);
    });
    
    console.log(subtaskTable.toString());
  } else {
    // Suggest expanding if no subtasks
    console.log(boxen(
      chalk.yellow('No subtasks found. Consider breaking down this task:') + '\n' +
      chalk.white(`Run: ${chalk.cyan(`node scripts/dev.js expand --id=${nextTask.id}`)}`),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show action suggestions
  console.log(boxen(
    chalk.white.bold('Suggested Actions:') + '\n' +
    `${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`node scripts/dev.js set-status --id=${nextTask.id} --status=in-progress`)}\n` +
    `${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`node scripts/dev.js set-status --id=${nextTask.id} --status=done`)}\n` +
    (nextTask.subtasks && nextTask.subtasks.length > 0 
      ? `${chalk.cyan('3.')} Update subtask status: ${chalk.yellow(`node scripts/dev.js set-status --id=${nextTask.id}.1 --status=done`)}`
      : `${chalk.cyan('3.')} Break down into subtasks: ${chalk.yellow(`node scripts/dev.js expand --id=${nextTask.id}`)}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
  ));
}

/**
 * Find a task by its ID
 * @param {Array} tasks - The array of tasks from tasks.json
 * @param {string|number} taskId - The ID of the task to find (can be a subtask ID like "1.1")
 * @returns {Object|null} - The found task or null if not found
 */
function findTaskById(tasks, taskId) {
  // Convert to string for comparison
  const idStr = String(taskId);
  
  // Check if it's a subtask ID (contains a dot)
  if (idStr.includes('.')) {
    const [parentId, subtaskId] = idStr.split('.');
    
    // Find the parent task
    const parentTask = tasks.find(t => String(t.id) === parentId);
    
    // If parent found and has subtasks, find the specific subtask
    if (parentTask && parentTask.subtasks && parentTask.subtasks.length > 0) {
      const subtask = parentTask.subtasks.find(st => String(st.id) === subtaskId);
      if (subtask) {
        // Create a copy with parent information
        return {
          ...subtask,
          parentId: parentTask.id,
          parentTitle: parentTask.title
        };
      }
    }
    return null;
  }
  
  // Regular task ID
  return tasks.find(t => String(t.id) === idStr) || null;
}

/**
 * Display a specific task by ID
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string|number} taskId - The ID of the task to display
 */
async function displayTaskById(tasksPath, taskId) {
  displayBanner();
  
  // Read the tasks file
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks found.");
    process.exit(1);
  }
  
  // Find the task by ID
  const task = findTaskById(data.tasks, taskId);
  
  if (!task) {
    console.log(boxen(
      chalk.yellow(`Task with ID ${taskId} not found!`),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
    return;
  }
  
  // Handle subtask display specially
  if (task.parentId !== undefined) {
    console.log(boxen(
      chalk.white.bold(`Subtask: #${task.parentId}.${task.id} - ${task.title}`),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'magenta', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
    
    // Create a table with subtask details
    const taskTable = new Table({
      style: {
        head: [],
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      },
      colWidths: [15, 75]
    });
    
    // Add subtask details to table
    taskTable.push(
      [chalk.cyan.bold('ID:'), `${task.parentId}.${task.id}`],
      [chalk.cyan.bold('Parent Task:'), `#${task.parentId} - ${task.parentTitle}`],
      [chalk.cyan.bold('Title:'), task.title],
      [chalk.cyan.bold('Status:'), getStatusWithColor(task.status || 'pending')],
      [chalk.cyan.bold('Description:'), task.description || 'No description provided.']
    );
    
    console.log(taskTable.toString());
    
    // Show action suggestions for subtask
    console.log(boxen(
      chalk.white.bold('Suggested Actions:') + '\n' +
      `${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`node scripts/dev.js set-status --id=${task.parentId}.${task.id} --status=in-progress`)}\n` +
      `${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`node scripts/dev.js set-status --id=${task.parentId}.${task.id} --status=done`)}\n` +
      `${chalk.cyan('3.')} View parent task: ${chalk.yellow(`node scripts/dev.js show --id=${task.parentId}`)}`,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    return;
  }
  
  // Display a regular task
  console.log(boxen(
    chalk.white.bold(`Task: #${task.id} - ${task.title}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
  ));
  
  // Create a table with task details
  const taskTable = new Table({
    style: {
      head: [],
      border: [],
      'padding-top': 0,
      'padding-bottom': 0,
      compact: true
    },
    chars: {
      'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
    },
    colWidths: [15, 75]
  });
  
  // Priority with color
  const priorityColors = {
    'high': chalk.red.bold,
    'medium': chalk.yellow,
    'low': chalk.gray
  };
  const priorityColor = priorityColors[task.priority || 'medium'] || chalk.white;
  
  // Add task details to table
  taskTable.push(
    [chalk.cyan.bold('ID:'), task.id.toString()],
    [chalk.cyan.bold('Title:'), task.title],
    [chalk.cyan.bold('Status:'), getStatusWithColor(task.status || 'pending')],
    [chalk.cyan.bold('Priority:'), priorityColor(task.priority || 'medium')],
    [chalk.cyan.bold('Dependencies:'), formatDependenciesWithStatus(task.dependencies, data.tasks, true)],
    [chalk.cyan.bold('Description:'), task.description]
  );
  
  console.log(taskTable.toString());
  
  // If task has details, show them in a separate box
  if (task.details && task.details.trim().length > 0) {
    console.log(boxen(
      chalk.white.bold('Implementation Details:') + '\n\n' + 
      task.details,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show test strategy if available
  if (task.testStrategy && task.testStrategy.trim().length > 0) {
    console.log(boxen(
      chalk.white.bold('Test Strategy:') + '\n\n' + 
      task.testStrategy,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show subtasks if they exist
  if (task.subtasks && task.subtasks.length > 0) {
    console.log(boxen(
      chalk.white.bold('Subtasks'),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, margin: { top: 1, bottom: 0 }, borderColor: 'magenta', borderStyle: 'round' }
    ));
    
    // Create a table for subtasks
    const subtaskTable = new Table({
      head: [
        chalk.magenta.bold('ID'), 
        chalk.magenta.bold('Status'), 
        chalk.magenta.bold('Title'),
        chalk.magenta.bold('Dependencies')
      ],
      colWidths: [6, 12, 50, 20],
      style: {
        head: [],
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      }
    });
    
    // Add subtasks to table
    task.subtasks.forEach(st => {
      const statusColor = {
        'done': chalk.green,
        'completed': chalk.green,
        'pending': chalk.yellow,
        'in-progress': chalk.blue
      }[st.status || 'pending'] || chalk.white;
      
      // Format subtask dependencies
      let subtaskDeps = 'None';
      if (st.dependencies && st.dependencies.length > 0) {
        // Format dependencies with correct notation
        const formattedDeps = st.dependencies.map(depId => {
          if (typeof depId === 'number' && depId < 100) {
            return `${task.id}.${depId}`;
          }
          return depId;
        });
        subtaskDeps = formatDependenciesWithStatus(formattedDeps, data.tasks, true);
      }
      
      subtaskTable.push([
        `${task.id}.${st.id}`,
        statusColor(st.status || 'pending'),
        st.title,
        subtaskDeps
      ]);
    });
    
    console.log(subtaskTable.toString());
  } else {
    // Suggest expanding if no subtasks
    console.log(boxen(
      chalk.yellow('No subtasks found. Consider breaking down this task:') + '\n' +
      chalk.white(`Run: ${chalk.cyan(`node scripts/dev.js expand --id=${task.id}`)}`),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show action suggestions
  console.log(boxen(
    chalk.white.bold('Suggested Actions:') + '\n' +
    `${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`node scripts/dev.js set-status --id=${task.id} --status=in-progress`)}\n` +
    `${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`node scripts/dev.js set-status --id=${task.id} --status=done`)}\n` +
    (task.subtasks && task.subtasks.length > 0 
      ? `${chalk.cyan('3.')} Update subtask status: ${chalk.yellow(`node scripts/dev.js set-status --id=${task.id}.1 --status=done`)}`
      : `${chalk.cyan('3.')} Break down into subtasks: ${chalk.yellow(`node scripts/dev.js expand --id=${task.id}`)}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
  ));
}

/**
 * Format a task or subtask ID into the correct string format
 * @param {string|number} id - The task or subtask ID to format
 * @returns {string|number} - The formatted ID
 */
function formatTaskId(id) {
  // If it's already a string with a dot notation, leave as is
  if (typeof id === 'string' && id.includes('.')) {
    return id;
  }
  
  // If it's a number or a string without a dot, convert to number
  if (typeof id === 'number' || !id.includes('.')) {
    return parseInt(id, 10);
  }
  
  return id;
}

/**
 * Check if a task or subtask with the given ID exists
 * @param {Array} tasks - All tasks
 * @param {string|number} taskId - ID to check
 * @returns {boolean} - True if the task or subtask exists
 */
function taskExists(tasks, taskId) {
  // Check if it's a subtask ID (e.g., "1.2")
  const isSubtask = typeof taskId === 'string' && taskId.includes('.');
  
  if (isSubtask) {
    // Parse parent and subtask IDs
    const [parentId, subtaskId] = taskId.split('.').map(id => isNaN(id) ? id : Number(id));
    const parentTask = tasks.find(t => t.id === parentId);
    
    // Check if parent task exists and has the specific subtask
    if (parentTask && parentTask.subtasks) {
      return parentTask.subtasks.some(s => s.id === Number(subtaskId));
    }
    return false;
  } else {
    // Regular task (not a subtask)
    return tasks.some(t => t.id === Number(taskId));
  }
}

async function addDependency(tasksPath, taskId, dependencyId) {
  log('info', `Adding dependency ${dependencyId} to task ${taskId}...`);
  
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', 'No valid tasks found in tasks.json');
    process.exit(1);
  }
  
  // Format the task and dependency IDs correctly
  const formattedTaskId = typeof taskId === 'string' && taskId.includes('.') 
    ? taskId : parseInt(taskId, 10);
    
  const formattedDependencyId = formatTaskId(dependencyId);
  
  // Check if the dependency task or subtask actually exists
  if (!taskExists(data.tasks, formattedDependencyId)) {
    log('error', `Dependency target ${formattedDependencyId} does not exist in tasks.json`);
    process.exit(1);
  }
  
  // Find the task to update
  let targetTask = null;
  let isSubtask = false;
  
  if (typeof formattedTaskId === 'string' && formattedTaskId.includes('.')) {
    // Handle dot notation for subtasks (e.g., "1.2")
    const [parentId, subtaskId] = formattedTaskId.split('.').map(id => parseInt(id, 10));
    const parentTask = data.tasks.find(t => t.id === parentId);
    
    if (!parentTask) {
      log('error', `Parent task ${parentId} not found.`);
      process.exit(1);
    }
    
    if (!parentTask.subtasks) {
      log('error', `Parent task ${parentId} has no subtasks.`);
      process.exit(1);
    }
    
    targetTask = parentTask.subtasks.find(s => s.id === subtaskId);
    isSubtask = true;
    
    if (!targetTask) {
      log('error', `Subtask ${formattedTaskId} not found.`);
      process.exit(1);
    }
  } else {
    // Regular task (not a subtask)
    targetTask = data.tasks.find(t => t.id === formattedTaskId);
    
    if (!targetTask) {
      log('error', `Task ${formattedTaskId} not found.`);
      process.exit(1);
    }
  }
  
  // Initialize dependencies array if it doesn't exist
  if (!targetTask.dependencies) {
    targetTask.dependencies = [];
  }
  
  // Check if dependency already exists
  if (targetTask.dependencies.some(d => {
    // Convert both to strings for comparison to handle both numeric and string IDs
    return String(d) === String(formattedDependencyId);
  })) {
    log('warn', `Dependency ${formattedDependencyId} already exists in task ${formattedTaskId}.`);
    return;
  }
  
  // Check if the task is trying to depend on itself
  if (String(formattedTaskId) === String(formattedDependencyId)) {
    log('error', `Task ${formattedTaskId} cannot depend on itself.`);
    process.exit(1);
  }
  
  // Check for circular dependencies
  let dependencyChain = [formattedTaskId];
  if (!isCircularDependency(data.tasks, formattedDependencyId, dependencyChain)) {
    // Add the dependency
    targetTask.dependencies.push(formattedDependencyId);
    
    // Sort dependencies numerically or by parent task ID first, then subtask ID
    targetTask.dependencies.sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
      } else if (typeof a === 'string' && typeof b === 'string') {
        const [aParent, aChild] = a.split('.').map(Number);
        const [bParent, bChild] = b.split('.').map(Number);
        return aParent !== bParent ? aParent - bParent : aChild - bChild;
      } else if (typeof a === 'number') {
        return -1; // Numbers come before strings
      } else {
        return 1; // Strings come after numbers
      }
    });
    
    // Save changes
    writeJSON(tasksPath, data);
    log('success', `Added dependency ${formattedDependencyId} to task ${formattedTaskId}`);
    
    // Generate updated task files
    await generateTaskFiles(tasksPath, 'tasks');
    
    log('info', 'Task files regenerated with updated dependencies.');
  } else {
    log('error', `Cannot add dependency ${formattedDependencyId} to task ${formattedTaskId} as it would create a circular dependency.`);
    process.exit(1);
  }
}

/**
 * Remove a dependency from a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} taskId - ID of the task to remove dependency from
 * @param {number|string} dependencyId - ID of the task to remove as dependency
 */
async function removeDependency(tasksPath, taskId, dependencyId) {
  log('info', `Removing dependency ${dependencyId} from task ${taskId}...`);
  
  // Read tasks file
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks found.");
    process.exit(1);
  }
  
  // Format the task and dependency IDs correctly
  const formattedTaskId = typeof taskId === 'string' && taskId.includes('.') 
    ? taskId : parseInt(taskId, 10);
    
  const formattedDependencyId = formatTaskId(dependencyId);
  
  // Find the task to update
  let targetTask = null;
  let isSubtask = false;
  
  if (typeof formattedTaskId === 'string' && formattedTaskId.includes('.')) {
    // Handle dot notation for subtasks (e.g., "1.2")
    const [parentId, subtaskId] = formattedTaskId.split('.').map(id => parseInt(id, 10));
    const parentTask = data.tasks.find(t => t.id === parentId);
    
    if (!parentTask) {
      log('error', `Parent task ${parentId} not found.`);
      process.exit(1);
    }
    
    if (!parentTask.subtasks) {
      log('error', `Parent task ${parentId} has no subtasks.`);
      process.exit(1);
    }
    
    targetTask = parentTask.subtasks.find(s => s.id === subtaskId);
    isSubtask = true;
    
    if (!targetTask) {
      log('error', `Subtask ${formattedTaskId} not found.`);
      process.exit(1);
    }
  } else {
    // Regular task (not a subtask)
    targetTask = data.tasks.find(t => t.id === formattedTaskId);
    
    if (!targetTask) {
      log('error', `Task ${formattedTaskId} not found.`);
      process.exit(1);
    }
  }
  
  // Check if the task has any dependencies
  if (!targetTask.dependencies || targetTask.dependencies.length === 0) {
    log('info', `Task ${formattedTaskId} has no dependencies, nothing to remove.`);
    return;
  }
  
  // Normalize the dependency ID for comparison to handle different formats
  const normalizedDependencyId = String(formattedDependencyId);
  
  // Check if the dependency exists by comparing string representations
  const dependencyIndex = targetTask.dependencies.findIndex(dep => {
    // Convert both to strings for comparison
    let depStr = String(dep);
    
    // Special handling for numeric IDs that might be subtask references
    if (typeof dep === 'number' && dep < 100 && isSubtask) {
      // It's likely a reference to another subtask in the same parent task
      // Convert to full format for comparison (e.g., 2 -> "1.2" for a subtask in task 1)
      const [parentId] = formattedTaskId.split('.');
      depStr = `${parentId}.${dep}`;
    }
    
    return depStr === normalizedDependencyId;
  });
  
  if (dependencyIndex === -1) {
    log('info', `Task ${formattedTaskId} does not depend on ${formattedDependencyId}, no changes made.`);
    return;
  }
  
  // Remove the dependency
  targetTask.dependencies.splice(dependencyIndex, 1);
  
  // Save the updated tasks
  writeJSON(tasksPath, data);
  
  // Success message
  log('success', `Removed dependency: Task ${formattedTaskId} no longer depends on ${formattedDependencyId}`);
  
  // Display a more visually appealing success message
  console.log(boxen(
    chalk.green(`Successfully removed dependency:\n\n`) +
    `Task ${chalk.bold(formattedTaskId)} no longer depends on ${chalk.bold(formattedDependencyId)}`,
    { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
  ));
  
  // Regenerate task files
  await generateTaskFiles(tasksPath, 'tasks');
}

/**
 * Check if adding a dependency would create a circular dependency
 * @param {Array} tasks - All tasks
 * @param {number|string} dependencyId - ID of the dependency being added
 * @param {Array} chain - Current dependency chain being checked
 * @returns {boolean} - True if circular dependency would be created, false otherwise
 */
function isCircularDependency(tasks, dependencyId, chain = []) {
  // Convert chain elements and dependencyId to strings for consistent comparison
  const chainStrs = chain.map(id => String(id));
  const depIdStr = String(dependencyId);
  
  // If the dependency is already in the chain, it would create a circular dependency
  if (chainStrs.includes(depIdStr)) {
    log('error', `Circular dependency detected: ${chainStrs.join(' -> ')} -> ${depIdStr}`);
    return true;
  }
  
  // Check if this is a subtask dependency (e.g., "1.2")
  const isSubtask = depIdStr.includes('.');
  
  // Find the task or subtask by ID
  let dependencyTask = null;
  let dependencySubtask = null;
  
  if (isSubtask) {
    // Parse parent and subtask IDs
    const [parentId, subtaskId] = depIdStr.split('.').map(id => isNaN(id) ? id : Number(id));
    const parentTask = tasks.find(t => t.id === parentId);
    
    if (parentTask && parentTask.subtasks) {
      dependencySubtask = parentTask.subtasks.find(s => s.id === Number(subtaskId));
      // For a subtask, we need to check dependencies of both the subtask and its parent
      if (dependencySubtask && dependencySubtask.dependencies && dependencySubtask.dependencies.length > 0) {
        // Recursively check each of the subtask's dependencies
        const newChain = [...chainStrs, depIdStr];
        const hasCircular = dependencySubtask.dependencies.some(depId => {
          // Handle relative subtask references (e.g., numeric IDs referring to subtasks in the same parent task)
          const normalizedDepId = typeof depId === 'number' && depId < 100 
            ? `${parentId}.${depId}` 
            : depId;
          return isCircularDependency(tasks, normalizedDepId, newChain);
        });
        
        if (hasCircular) return true;
      }
      
      // Also check if parent task has dependencies that could create a cycle
      if (parentTask.dependencies && parentTask.dependencies.length > 0) {
        // If any of the parent's dependencies create a cycle, return true
        const newChain = [...chainStrs, depIdStr];
        if (parentTask.dependencies.some(depId => isCircularDependency(tasks, depId, newChain))) {
          return true;
        }
      }
      
      return false;
    }
  } else {
    // Regular task (not a subtask)
    const depId = isNaN(dependencyId) ? dependencyId : Number(dependencyId);
    dependencyTask = tasks.find(t => t.id === depId);
    
    // If task not found or has no dependencies, there's no circular dependency
    if (!dependencyTask || !dependencyTask.dependencies || dependencyTask.dependencies.length === 0) {
      return false;
    }
    
    // Recursively check each of the dependency's dependencies
    const newChain = [...chainStrs, depIdStr];
    if (dependencyTask.dependencies.some(depId => isCircularDependency(tasks, depId, newChain))) {
      return true;
    }
    
    // Also check for cycles through subtasks of this task
    if (dependencyTask.subtasks && dependencyTask.subtasks.length > 0) {
      for (const subtask of dependencyTask.subtasks) {
        if (subtask.dependencies && subtask.dependencies.length > 0) {
          // Check if any of this subtask's dependencies create a cycle
          const subtaskId = `${dependencyTask.id}.${subtask.id}`;
          const newSubtaskChain = [...chainStrs, depIdStr, subtaskId];
          
          for (const subDepId of subtask.dependencies) {
            // Handle relative subtask references
            const normalizedDepId = typeof subDepId === 'number' && subDepId < 100 
              ? `${dependencyTask.id}.${subDepId}` 
              : subDepId;
            
            if (isCircularDependency(tasks, normalizedDepId, newSubtaskChain)) {
              return true;
            }
          }
        }
      }
    }
  }
  
  return false;
}

// At the very end of the file
main().catch(err => {
  console.error('ERROR in main:', err);
  process.exit(1);
});

/**
 * Validate and clean up task dependencies to ensure they only reference existing tasks
 * @param {Array} tasks - Array of tasks to validate
 * @param {string} tasksPath - Optional path to tasks.json to save changes
 * @returns {boolean} - True if any changes were made to dependencies
 */
function validateTaskDependencies(tasks, tasksPath = null) {
  // Create a set of valid task IDs for fast lookup
  const validTaskIds = new Set(tasks.map(t => t.id));
  
  // Create a set of valid subtask IDs (in the format "parentId.subtaskId")
  const validSubtaskIds = new Set();
  tasks.forEach(task => {
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach(subtask => {
        validSubtaskIds.add(`${task.id}.${subtask.id}`);
      });
    }
  });
  
  // Flag to track if any changes were made
  let changesDetected = false;
  
  // Validate all tasks and their dependencies
  tasks.forEach(task => {
    if (task.dependencies && Array.isArray(task.dependencies)) {
      // First check for and remove duplicate dependencies
      const uniqueDeps = new Set();
      const uniqueDependencies = task.dependencies.filter(depId => {
        // Convert to string for comparison to handle both numeric and string IDs
        const depIdStr = String(depId);
        if (uniqueDeps.has(depIdStr)) {
          log('warn', `Removing duplicate dependency from task ${task.id}: ${depId}`);
          changesDetected = true;
          return false;
        }
        uniqueDeps.add(depIdStr);
        return true;
      });
      
      // If we removed duplicates, update the array
      if (uniqueDependencies.length !== task.dependencies.length) {
        task.dependencies = uniqueDependencies;
        changesDetected = true;
      }
      
      const validDependencies = uniqueDependencies.filter(depId => {
        const isSubtask = typeof depId === 'string' && depId.includes('.');
        
        if (isSubtask) {
          // Check if the subtask exists
          if (!validSubtaskIds.has(depId)) {
            log('warn', `Removing invalid subtask dependency from task ${task.id}: ${depId} (subtask does not exist)`);
            return false;
          }
          return true;
        } else {
          // Check if the task exists
          const numericId = typeof depId === 'string' ? parseInt(depId, 10) : depId;
          if (!validTaskIds.has(numericId)) {
            log('warn', `Removing invalid task dependency from task ${task.id}: ${depId} (task does not exist)`);
            return false;
          }
          return true;
        }
      });
      
      // Update the task's dependencies array
      if (validDependencies.length !== uniqueDependencies.length) {
        task.dependencies = validDependencies;
        changesDetected = true;
      }
    }
    
    // Validate subtask dependencies
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach(subtask => {
        if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
          // First check for and remove duplicate dependencies
          const uniqueDeps = new Set();
          const uniqueDependencies = subtask.dependencies.filter(depId => {
            // Convert to string for comparison to handle both numeric and string IDs
            const depIdStr = String(depId);
            if (uniqueDeps.has(depIdStr)) {
              log('warn', `Removing duplicate dependency from subtask ${task.id}.${subtask.id}: ${depId}`);
              changesDetected = true;
              return false;
            }
            uniqueDeps.add(depIdStr);
            return true;
          });
          
          // If we removed duplicates, update the array
          if (uniqueDependencies.length !== subtask.dependencies.length) {
            subtask.dependencies = uniqueDependencies;
            changesDetected = true;
          }
          
          // Check for and remove self-dependencies
          const subtaskId = `${task.id}.${subtask.id}`;
          const selfDependencyIndex = subtask.dependencies.findIndex(depId => {
            return String(depId) === String(subtaskId);
          });
          
          if (selfDependencyIndex !== -1) {
            log('warn', `Removing self-dependency from subtask ${subtaskId} (subtask cannot depend on itself)`);
            subtask.dependencies.splice(selfDependencyIndex, 1);
            changesDetected = true;
          }
          
          // Then validate remaining dependencies
          const validSubtaskDeps = subtask.dependencies.filter(depId => {
            const isSubtask = typeof depId === 'string' && depId.includes('.');
            
            if (isSubtask) {
              // Check if the subtask exists
              if (!validSubtaskIds.has(depId)) {
                log('warn', `Removing invalid subtask dependency from subtask ${task.id}.${subtask.id}: ${depId} (subtask does not exist)`);
                return false;
              }
              return true;
            } else {
              // Check if the task exists
              const numericId = typeof depId === 'string' ? parseInt(depId, 10) : depId;
              if (!validTaskIds.has(numericId)) {
                log('warn', `Removing invalid task dependency from task ${task.id}: ${depId} (task does not exist)`);
                return false;
              }
              return true;
            }
          });
          
          // Update the subtask's dependencies array
          if (validSubtaskDeps.length !== subtask.dependencies.length) {
            subtask.dependencies = validSubtaskDeps;
            changesDetected = true;
          }
        }
      });
    }
  });
  
  // Save changes if tasksPath is provided and changes were detected
  if (tasksPath && changesDetected) {
    try {
      const data = readJSON(tasksPath);
      if (data) {
        data.tasks = tasks;
        writeJSON(tasksPath, data);
        log('info', 'Updated tasks.json to remove invalid and duplicate dependencies');
      }
    } catch (error) {
      log('error', 'Failed to save changes to tasks.json', error);
    }
  }
  
  return changesDetected;
}

async function validateDependenciesCommand(tasksPath) {
  displayBanner();
  
  log('info', 'Checking for invalid dependencies in task files...');
  
  // Read tasks data
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', 'No valid tasks found in tasks.json');
    process.exit(1);
  }
  
  // Count of tasks and subtasks for reporting
  const taskCount = data.tasks.length;
  let subtaskCount = 0;
  data.tasks.forEach(task => {
    if (task.subtasks && Array.isArray(task.subtasks)) {
      subtaskCount += task.subtasks.length;
    }
  });
  
  log('info', `Analyzing dependencies for ${taskCount} tasks and ${subtaskCount} subtasks...`);
  
  // Track validation statistics
  const stats = {
    nonExistentDependenciesRemoved: 0,
    selfDependenciesRemoved: 0,
    tasksFixed: 0,
    subtasksFixed: 0
  };
  
  // Monkey patch the log function to capture warnings and count fixes
  const originalLog = log;
  const warnings = [];
  log = function(level, ...args) {
    if (level === 'warn') {
      warnings.push(args.join(' '));
      
      // Count the type of fix based on the warning message
      const msg = args.join(' ');
      if (msg.includes('self-dependency')) {
        stats.selfDependenciesRemoved++;
      } else if (msg.includes('invalid')) {
        stats.nonExistentDependenciesRemoved++;
      }
      
      // Count if it's a task or subtask being fixed
      if (msg.includes('from subtask')) {
        stats.subtasksFixed++;
      } else if (msg.includes('from task')) {
        stats.tasksFixed++;
      }
    }
    // Call the original log function
    return originalLog(level, ...args);
  };
  
  // Run validation
  try {
    const changesDetected = validateTaskDependencies(data.tasks, tasksPath);
    
    // Create a detailed report
    if (changesDetected) {
      log('success', 'Invalid dependencies were removed from tasks.json');
      
      // Show detailed stats in a nice box
      console.log(boxen(
        chalk.green(`Dependency Validation Results:\n\n`) +
        `${chalk.cyan('Tasks checked:')} ${taskCount}\n` +
        `${chalk.cyan('Subtasks checked:')} ${subtaskCount}\n` +
        `${chalk.cyan('Non-existent dependencies removed:')} ${stats.nonExistentDependenciesRemoved}\n` +
        `${chalk.cyan('Self-dependencies removed:')} ${stats.selfDependenciesRemoved}\n` +
        `${chalk.cyan('Tasks fixed:')} ${stats.tasksFixed}\n` +
        `${chalk.cyan('Subtasks fixed:')} ${stats.subtasksFixed}`,
        { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
      ));
      
      // Show all warnings in a collapsible list if there are many
      if (warnings.length > 0) {
        console.log(chalk.yellow('\nDetailed fixes:'));
        warnings.forEach(warning => {
          console.log(`  ${warning}`);
        });
      }
      
      // Regenerate task files to reflect the changes
      await generateTaskFiles(tasksPath, path.dirname(tasksPath));
      log('info', 'Task files regenerated to reflect dependency changes');
    } else {
      log('success', 'No invalid dependencies found - all dependencies are valid');
      
      // Show validation summary
      console.log(boxen(
        chalk.green(`All Dependencies Are Valid\n\n`) +
        `${chalk.cyan('Tasks checked:')} ${taskCount}\n` +
        `${chalk.cyan('Subtasks checked:')} ${subtaskCount}\n` +
        `${chalk.cyan('Total dependencies verified:')} ${countAllDependencies(data.tasks)}`,
        { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
      ));
    }
  } finally {
    // Restore the original log function
    log = originalLog;
  }
}

/**
 * Helper function to count all dependencies across tasks and subtasks
 * @param {Array} tasks - All tasks
 * @returns {number} - Total number of dependencies
 */
function countAllDependencies(tasks) {
  let count = 0;
  
  tasks.forEach(task => {
    // Count main task dependencies
    if (task.dependencies && Array.isArray(task.dependencies)) {
      count += task.dependencies.length;
    }
    
    // Count subtask dependencies
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach(subtask => {
        if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
          count += subtask.dependencies.length;
        }
      });
    }
  });
  
  return count;
}

// New command implementation
async function fixDependenciesCommand(tasksPath) {
  displayBanner();
  
  log('info', 'Checking for and fixing invalid dependencies in tasks.json...');
  
  try {
    // Read tasks data
    const data = readJSON(tasksPath);
    if (!data || !data.tasks) {
      log('error', 'No valid tasks found in tasks.json');
      process.exit(1);
    }
    
    // Create a deep copy of the original data for comparison
    const originalData = JSON.parse(JSON.stringify(data));
    
    // Track fixes for reporting
    const stats = {
      nonExistentDependenciesRemoved: 0,
      selfDependenciesRemoved: 0,
      duplicateDependenciesRemoved: 0,
      circularDependenciesFixed: 0,
      tasksFixed: 0,
      subtasksFixed: 0
    };
    
    // First phase: Remove duplicate dependencies in tasks
    data.tasks.forEach(task => {
      if (task.dependencies && Array.isArray(task.dependencies)) {
        const uniqueDeps = new Set();
        const originalLength = task.dependencies.length;
        task.dependencies = task.dependencies.filter(depId => {
          const depIdStr = String(depId);
          if (uniqueDeps.has(depIdStr)) {
            log('info', `Removing duplicate dependency from task ${task.id}: ${depId}`);
            stats.duplicateDependenciesRemoved++;
            return false;
          }
          uniqueDeps.add(depIdStr);
          return true;
        });
        if (task.dependencies.length < originalLength) {
          stats.tasksFixed++;
        }
      }
      
      // Check for duplicates in subtasks
      if (task.subtasks && Array.isArray(task.subtasks)) {
        task.subtasks.forEach(subtask => {
          if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
            const uniqueDeps = new Set();
            const originalLength = subtask.dependencies.length;
            subtask.dependencies = subtask.dependencies.filter(depId => {
              let depIdStr = String(depId);
              if (typeof depId === 'number' && depId < 100) {
                depIdStr = `${task.id}.${depId}`;
              }
              if (uniqueDeps.has(depIdStr)) {
                log('info', `Removing duplicate dependency from subtask ${task.id}.${subtask.id}: ${depId}`);
                stats.duplicateDependenciesRemoved++;
                return false;
              }
              uniqueDeps.add(depIdStr);
              return true;
            });
            if (subtask.dependencies.length < originalLength) {
              stats.subtasksFixed++;
            }
          }
        });
      }
    });
    
    // Create validity maps for tasks and subtasks
    const validTaskIds = new Set(data.tasks.map(t => t.id));
    const validSubtaskIds = new Set();
    data.tasks.forEach(task => {
      if (task.subtasks && Array.isArray(task.subtasks)) {
        task.subtasks.forEach(subtask => {
          validSubtaskIds.add(`${task.id}.${subtask.id}`);
        });
      }
    });
    
    // Second phase: Remove invalid task dependencies (non-existent tasks)
    data.tasks.forEach(task => {
      if (task.dependencies && Array.isArray(task.dependencies)) {
        const originalLength = task.dependencies.length;
        task.dependencies = task.dependencies.filter(depId => {
          const isSubtask = typeof depId === 'string' && depId.includes('.');
          
          if (isSubtask) {
            // Check if the subtask exists
            if (!validSubtaskIds.has(depId)) {
              log('info', `Removing invalid subtask dependency from task ${task.id}: ${depId} (subtask does not exist)`);
              stats.nonExistentDependenciesRemoved++;
              return false;
            }
            return true;
          } else {
            // Check if the task exists
            const numericId = typeof depId === 'string' ? parseInt(depId, 10) : depId;
            if (!validTaskIds.has(numericId)) {
              log('info', `Removing invalid task dependency from task ${task.id}: ${depId} (task does not exist)`);
              stats.nonExistentDependenciesRemoved++;
              return false;
            }
            return true;
          }
        });
        
        if (task.dependencies.length < originalLength) {
          stats.tasksFixed++;
        }
      }
      
      // Check subtask dependencies for invalid references
      if (task.subtasks && Array.isArray(task.subtasks)) {
        task.subtasks.forEach(subtask => {
          if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
            const originalLength = subtask.dependencies.length;
            const subtaskId = `${task.id}.${subtask.id}`;
            
            // First check for self-dependencies
            const hasSelfDependency = subtask.dependencies.some(depId => {
              if (typeof depId === 'string' && depId.includes('.')) {
                return depId === subtaskId;
              } else if (typeof depId === 'number' && depId < 100) {
                return depId === subtask.id;
              }
              return false;
            });
            
            if (hasSelfDependency) {
              subtask.dependencies = subtask.dependencies.filter(depId => {
                const normalizedDepId = typeof depId === 'number' && depId < 100 
                  ? `${task.id}.${depId}` 
                  : String(depId);
                
                if (normalizedDepId === subtaskId) {
                  log('info', `Removing self-dependency from subtask ${subtaskId}`);
                  stats.selfDependenciesRemoved++;
                  return false;
                }
                return true;
              });
            }
            
            // Then check for non-existent dependencies
            subtask.dependencies = subtask.dependencies.filter(depId => {
              if (typeof depId === 'string' && depId.includes('.')) {
                if (!validSubtaskIds.has(depId)) {
                  log('info', `Removing invalid subtask dependency from subtask ${subtaskId}: ${depId} (subtask does not exist)`);
                  stats.nonExistentDependenciesRemoved++;
                  return false;
                }
                return true;
              }
              
              // Handle numeric dependencies
              const numericId = typeof depId === 'number' ? depId : parseInt(depId, 10);
              
              // Small numbers likely refer to subtasks in the same task
              if (numericId < 100) {
                const fullSubtaskId = `${task.id}.${numericId}`;
                
                if (!validSubtaskIds.has(fullSubtaskId)) {
                  log('info', `Removing invalid subtask dependency from subtask ${subtaskId}: ${numericId}`);
                  stats.nonExistentDependenciesRemoved++;
                  return false;
                }
                
                return true;
              }
              
              // Otherwise it's a task reference
              if (!validTaskIds.has(numericId)) {
                log('info', `Removing invalid task dependency from subtask ${subtaskId}: ${numericId}`);
                stats.nonExistentDependenciesRemoved++;
                return false;
              }
              
              return true;
            });
            
            if (subtask.dependencies.length < originalLength) {
              stats.subtasksFixed++;
            }
          }
        });
      }
    });
    
    // Third phase: Check for circular dependencies
    log('info', 'Checking for circular dependencies...');
    
    // Build the dependency map for subtasks
    const subtaskDependencyMap = new Map();
    data.tasks.forEach(task => {
      if (task.subtasks && Array.isArray(task.subtasks)) {
        task.subtasks.forEach(subtask => {
          const subtaskId = `${task.id}.${subtask.id}`;
          
          if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
            const normalizedDeps = subtask.dependencies.map(depId => {
              if (typeof depId === 'string' && depId.includes('.')) {
                return depId;
              } else if (typeof depId === 'number' && depId < 100) {
                return `${task.id}.${depId}`;
              }
              return String(depId);
            });
            subtaskDependencyMap.set(subtaskId, normalizedDeps);
          } else {
            subtaskDependencyMap.set(subtaskId, []);
          }
        });
      }
    });
    
    // Check for and fix circular dependencies
    for (const [subtaskId, dependencies] of subtaskDependencyMap.entries()) {
      const visited = new Set();
      const recursionStack = new Set();
      
      // Detect cycles
      const cycleEdges = findCycles(subtaskId, subtaskDependencyMap, visited, recursionStack);
      
      if (cycleEdges.length > 0) {
        const [taskId, subtaskNum] = subtaskId.split('.').map(part => Number(part));
        const task = data.tasks.find(t => t.id === taskId);
        
        if (task && task.subtasks) {
          const subtask = task.subtasks.find(st => st.id === subtaskNum);
          
          if (subtask && subtask.dependencies) {
            const originalLength = subtask.dependencies.length;
            
            const edgesToRemove = cycleEdges.map(edge => {
              if (edge.includes('.')) {
                const [depTaskId, depSubtaskId] = edge.split('.').map(part => Number(part));
                
                if (depTaskId === taskId) {
                  return depSubtaskId;
                }
                
                return edge;
              }
              
              return Number(edge);
            });
            
            subtask.dependencies = subtask.dependencies.filter(depId => {
              const normalizedDepId = typeof depId === 'number' && depId < 100 
                ? `${taskId}.${depId}` 
                : String(depId);
                
              if (edgesToRemove.includes(depId) || edgesToRemove.includes(normalizedDepId)) {
                log('info', `Breaking circular dependency: Removing ${normalizedDepId} from subtask ${subtaskId}`);
                stats.circularDependenciesFixed++;
                return false;
              }
              return true;
            });
            
            if (subtask.dependencies.length < originalLength) {
              stats.subtasksFixed++;
            }
          }
        }
      }
    }
    
    // Check if any changes were made by comparing with original data
    const dataChanged = JSON.stringify(data) !== JSON.stringify(originalData);
    
    if (dataChanged) {
      // Save the changes
      writeJSON(tasksPath, data);
      log('success', 'Fixed dependency issues in tasks.json');
      
      // Regenerate task files
      log('info', 'Regenerating task files to reflect dependency changes...');
      await generateTaskFiles(tasksPath, path.dirname(tasksPath));
    } else {
      log('info', 'No changes needed to fix dependencies');
    }
    
    // Show detailed statistics report
    const totalFixedAll = stats.nonExistentDependenciesRemoved + 
                        stats.selfDependenciesRemoved + 
                        stats.duplicateDependenciesRemoved + 
                        stats.circularDependenciesFixed;
    
    if (totalFixedAll > 0) {
      log('success', `Fixed ${totalFixedAll} dependency issues in total!`);
      
      console.log(boxen(
        chalk.green(`Dependency Fixes Summary:\n\n`) +
        `${chalk.cyan('Invalid dependencies removed:')} ${stats.nonExistentDependenciesRemoved}\n` +
        `${chalk.cyan('Self-dependencies removed:')} ${stats.selfDependenciesRemoved}\n` +
        `${chalk.cyan('Duplicate dependencies removed:')} ${stats.duplicateDependenciesRemoved}\n` +
        `${chalk.cyan('Circular dependencies fixed:')} ${stats.circularDependenciesFixed}\n\n` +
        `${chalk.cyan('Tasks fixed:')} ${stats.tasksFixed}\n` +
        `${chalk.cyan('Subtasks fixed:')} ${stats.subtasksFixed}\n`,
        { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
      ));
    } else {
      log('success', 'No dependency issues found - all dependencies are valid');
      
      console.log(boxen(
        chalk.green(`All Dependencies Are Valid\n\n`) +
        `${chalk.cyan('Tasks checked:')} ${data.tasks.length}\n` +
        `${chalk.cyan('Total dependencies verified:')} ${countAllDependencies(data.tasks)}`,
        { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
      ));
    }
  } catch (error) {
    log('error', "Error in fix-dependencies command:", error);
    process.exit(1);
  }
}

// Add a new function to clean up task dependencies before line 4030
/**
 * Clean up all subtask dependencies by removing any references to non-existent subtasks/tasks
 * @param {Object} data - The tasks data object from tasks.json
 * @param {string} tasksPath - Path to the tasks.json file
 * @returns {number} - The number of dependencies fixed
 */
function cleanupTaskDependencies(data, tasksPath) {
  if (!data || !data.tasks || !Array.isArray(data.tasks)) {
    log('error', 'Invalid tasks data');
    return 0;
  }
  
  log('info', 'Cleaning up all invalid subtask dependencies in tasks.json...');
  
  let totalFixed = 0;
  let totalCircularDepsFixed = 0;
  let totalDuplicatesRemoved = 0;
  
  // Create a set of valid task IDs and subtask IDs for validation
  const validTaskIds = new Set(data.tasks.map(t => t.id));
  const validSubtaskIds = new Set();
  
  // Create a map of subtask ID to its dependencies for cycle detection
  const subtaskDependencyMap = new Map();
  
  data.tasks.forEach(task => {
    // First, check for and remove duplicate dependencies in the main task
    if (task.dependencies && Array.isArray(task.dependencies)) {
      const uniqueDeps = new Set();
      const originalLength = task.dependencies.length;
      
      task.dependencies = task.dependencies.filter(depId => {
        // Convert to string for comparison
        const depIdStr = String(depId);
        if (uniqueDeps.has(depIdStr)) {
          log('info', `Removing duplicate dependency from task ${task.id}: ${depId}`);
          return false;
        }
        uniqueDeps.add(depIdStr);
        return true;
      });
      
      const duplicatesRemoved = originalLength - task.dependencies.length;
      totalDuplicatesRemoved += duplicatesRemoved;
    }
  
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach(subtask => {
        const subtaskId = `${task.id}.${subtask.id}`;
        validSubtaskIds.add(subtaskId);
        
        // First, check for and remove duplicate dependencies in subtasks
        if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
          const uniqueDeps = new Set();
          const originalLength = subtask.dependencies.length;
          
          subtask.dependencies = subtask.dependencies.filter(depId => {
            // Convert to string for comparison, handling special case for subtask references
            let depIdStr = String(depId);
            
            // For numeric IDs that are likely subtask references in the same parent task
            if (typeof depId === 'number' && depId < 100) {
              depIdStr = `${task.id}.${depId}`;
            }
            
            if (uniqueDeps.has(depIdStr)) {
              log('info', `Removing duplicate dependency from subtask ${subtaskId}: ${depId}`);
              return false;
            }
            uniqueDeps.add(depIdStr);
            return true;
          });
          
          const duplicatesRemoved = originalLength - subtask.dependencies.length;
          totalDuplicatesRemoved += duplicatesRemoved;
          
          // Add to dependency map for later cycle detection
          const normalizedDeps = subtask.dependencies.map(depId => {
            if (typeof depId === 'string' && depId.includes('.')) {
              return depId; // It's already a fully qualified subtask ID
            } else if (typeof depId === 'number' && depId < 100) {
              return `${task.id}.${depId}`; // A subtask in the current task
            }
            return String(depId); // A task ID
          });
          
          subtaskDependencyMap.set(subtaskId, normalizedDeps);
        } else {
          subtaskDependencyMap.set(subtaskId, []);
        }
      });
    }
  });
  
  // Now process non-existent dependencies
  data.tasks.forEach(task => {
    if (!task.subtasks || !Array.isArray(task.subtasks)) {
      return;
    }
    
    // Process each subtask's dependencies
    task.subtasks.forEach(subtask => {
      if (!subtask.dependencies || !Array.isArray(subtask.dependencies)) {
        return;
      }
      
      const originalLength = subtask.dependencies.length;
      const subtaskId = `${task.id}.${subtask.id}`;
      
      // Filter out invalid dependencies (non-existent or self-references)
      subtask.dependencies = subtask.dependencies.filter(depId => {
        // Check if it's a subtask reference (e.g., "1.2")
        if (typeof depId === 'string' && depId.includes('.')) {
          // It's invalid if it's not in our list of valid subtask IDs
          if (!validSubtaskIds.has(depId)) {
            log('info', `Removing invalid subtask dependency from subtask ${subtaskId}: ${depId}`);
            return false;
          }
          
          // Check for self-dependency
          if (depId === subtaskId) {
            log('info', `Removing self-dependency from subtask ${subtaskId}`);
            return false;
          }
          
          return true;
        }
        
        // For task references or numeric IDs
        const numericId = typeof depId === 'number' ? depId : parseInt(depId, 10);
        
        // It's a reference to a subtask in the same task
        if (numericId < 100) {
          const fullSubtaskId = `${task.id}.${numericId}`;
          
          // Check for self-dependency
          if (fullSubtaskId === subtaskId) {
            log('info', `Removing self-dependency from subtask ${subtaskId}`);
            return false;
          }
          
          if (!validSubtaskIds.has(fullSubtaskId)) {
            log('info', `Removing invalid subtask dependency from subtask ${subtaskId}: ${numericId}`);
            return false;
          }
          
          return true;
        }
        
        // It's a reference to another task
        if (!validTaskIds.has(numericId)) {
          log('info', `Removing invalid task dependency from subtask ${subtaskId}: ${numericId}`);
          return false;
        }
        
        return true;
      });
      
      // Check if we fixed anything
      if (subtask.dependencies.length < originalLength) {
        totalFixed += (originalLength - subtask.dependencies.length);
      }
    });
  });
  
  // After fixing invalid dependencies, detect and fix circular dependencies
  log('info', 'Checking for circular dependencies between subtasks...');
  
  // For each subtask, check if there are circular dependencies
  for (const [subtaskId, dependencies] of subtaskDependencyMap.entries()) {
    const visited = new Set();
    const recursionStack = new Set();
    
    // Clean up dependency map first - remove any non-existent dependencies
    subtaskDependencyMap.set(subtaskId, dependencies.filter(depId => {
      if (depId.includes('.')) {
        return validSubtaskIds.has(depId);
      }
      return validTaskIds.has(Number(depId));
    }));
    
    // Detect cycles
    const cycleEdges = findCycles(subtaskId, subtaskDependencyMap, visited, recursionStack);
    
    // Break cycles by removing dependencies
    if (cycleEdges.length > 0) {
      // Extract the task ID and subtask ID
      const [taskId, subtaskNum] = subtaskId.split('.').map(part => Number(part));
      const task = data.tasks.find(t => t.id === taskId);
      
      if (task && task.subtasks) {
        const subtask = task.subtasks.find(st => st.id === subtaskNum);
        
        if (subtask && subtask.dependencies) {
          // Filter out dependencies that cause cycles
          const originalLength = subtask.dependencies.length;
          
          // Convert cycleEdges to the format used in the task data
          const edgesToRemove = cycleEdges.map(edge => {
            if (edge.includes('.')) {
              const [depTaskId, depSubtaskId] = edge.split('.').map(part => Number(part));
              
              // If it's a subtask in the same task, return just the subtask ID as a number
              if (depTaskId === taskId) {
                return depSubtaskId;
              }
              
              // Otherwise, return the full subtask ID as a string
              return edge; // Full subtask ID string
            }
            
            // If it's a task ID, return as a number
            return Number(edge); // Task ID
          });
          
          // Remove the dependencies that cause cycles
          subtask.dependencies = subtask.dependencies.filter(depId => {
            const normalizedDepId = typeof depId === 'number' && depId < 100 
              ? `${taskId}.${depId}` 
              : String(depId);
              
            if (edgesToRemove.includes(depId) || edgesToRemove.includes(normalizedDepId)) {
              log('info', `Breaking circular dependency: Removing ${normalizedDepId} from ${subtaskId}`);
              return false;
            }
            return true;
          });
          
          // Count fixed circular dependencies
          const fixed = originalLength - subtask.dependencies.length;
          totalCircularDepsFixed += fixed;
          
          // Also update the dependency map
          subtaskDependencyMap.set(subtaskId, subtask.dependencies.map(depId => {
            if (typeof depId === 'string' && depId.includes('.')) {
              return depId;
            } else if (typeof depId === 'number' && depId < 100) {
              return `${taskId}.${depId}`;
            }
            return String(depId);
          }));
        }
      }
    }
  }
  
  // Output summary of fixes
  const totalFixedAll = totalFixed + totalCircularDepsFixed + totalDuplicatesRemoved;
  if (totalFixedAll > 0) {
    log('success', `Fixed ${totalFixed} invalid dependencies, ${totalCircularDepsFixed} circular dependencies, and ${totalDuplicatesRemoved} duplicate dependencies in tasks.json`);
    writeJSON(tasksPath, data);
  } else {
    log('info', 'No invalid, circular, or duplicate subtask dependencies found in tasks.json');
  }
  
  return totalFixedAll;
}

/**
 * Find cycles in a dependency graph using DFS
 * @param {string} subtaskId - Current subtask ID
 * @param {Map} dependencyMap - Map of subtask IDs to their dependencies
 * @param {Set} visited - Set of visited nodes
 * @param {Set} recursionStack - Set of nodes in current recursion stack
 * @returns {Array} - List of dependency edges that need to be removed to break cycles
 */
function findCycles(subtaskId, dependencyMap, visited = new Set(), recursionStack = new Set(), path = []) {
  // Mark the current node as visited and part of recursion stack
  visited.add(subtaskId);
  recursionStack.add(subtaskId);
  path.push(subtaskId);
  
  const cyclesToBreak = [];
  
  // Get all dependencies of the current subtask
  const dependencies = dependencyMap.get(subtaskId) || [];
  
  // For each dependency
  for (const depId of dependencies) {
    // If not visited, recursively check for cycles
    if (!visited.has(depId)) {
      const cycles = findCycles(depId, dependencyMap, visited, recursionStack, [...path]);
      cyclesToBreak.push(...cycles);
    } 
    // If the dependency is in the recursion stack, we found a cycle
    else if (recursionStack.has(depId)) {
      // Find the position of the dependency in the path
      const cycleStartIndex = path.indexOf(depId);
      // The last edge in the cycle is what we want to remove
      const cycleEdges = path.slice(cycleStartIndex);
      // We'll remove the last edge in the cycle (the one that points back)
      cyclesToBreak.push(depId);
    }
  }
  
  // Remove the node from recursion stack before returning
  recursionStack.delete(subtaskId);
  
  return cyclesToBreak;
}

/**
 * Validate and fix dependencies across all tasks and subtasks
 * This function is designed to be called after any task modification
 * @param {Object} tasksData - The tasks data object with tasks array
 * @param {string} tasksPath - Optional path to save the changes
 * @returns {boolean} - True if any changes were made
 */
function validateAndFixDependencies(tasksData, tasksPath = null) {
  if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
    log('error', 'Invalid tasks data');
    return false;
  }
  
  log('debug', 'Validating and fixing dependencies...');
  
  let changesDetected = false;
  
  // 1. Remove duplicate dependencies from tasks and subtasks
  const hasDuplicates = removeDuplicateDependencies(tasksData);
  if (hasDuplicates) changesDetected = true;
  
  // 2. Remove invalid task dependencies (non-existent tasks)
  const validationChanges = validateTaskDependencies(tasksData.tasks);
  if (validationChanges) changesDetected = true;
  
  // 3. Clean up subtask dependencies 
  const subtaskChanges = cleanupSubtaskDependencies(tasksData);
  if (subtaskChanges) changesDetected = true;
  
  // 4. Ensure at least one subtask has no dependencies in each task
  const noDepChanges = ensureAtLeastOneIndependentSubtask(tasksData);
  if (noDepChanges) changesDetected = true;
  
  // Save changes if needed
  if (tasksPath && changesDetected) {
    try {
      writeJSON(tasksPath, tasksData);
      log('debug', 'Saved dependency fixes to tasks.json');
    } catch (error) {
      log('error', 'Failed to save dependency fixes to tasks.json', error);
    }
  }
  
  return changesDetected;
}

/**
 * Remove duplicate dependencies from tasks and subtasks
 * @param {Object} tasksData - The tasks data object with tasks array
 * @returns {boolean} - True if any changes were made
 */
function removeDuplicateDependencies(tasksData) {
  if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
    return false;
  }
  
  let changesDetected = false;
  
  tasksData.tasks.forEach(task => {
    // Remove duplicates from main task dependencies
    if (task.dependencies && Array.isArray(task.dependencies)) {
      const uniqueDeps = new Set();
      const originalLength = task.dependencies.length;
      
      task.dependencies = task.dependencies.filter(depId => {
        const depIdStr = String(depId);
        if (uniqueDeps.has(depIdStr)) {
          log('debug', `Removing duplicate dependency from task ${task.id}: ${depId}`);
          return false;
        }
        uniqueDeps.add(depIdStr);
        return true;
      });
      
      if (task.dependencies.length < originalLength) {
        changesDetected = true;
      }
    }
    
    // Remove duplicates from subtask dependencies
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach(subtask => {
        if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
          const uniqueDeps = new Set();
          const originalLength = subtask.dependencies.length;
          
          subtask.dependencies = subtask.dependencies.filter(depId => {
            // Convert to string for comparison, handling special case for subtask references
            let depIdStr = String(depId);
            
            // For numeric IDs that are likely subtask references in the same parent task
            if (typeof depId === 'number' && depId < 100) {
              depIdStr = `${task.id}.${depId}`;
            }
            
            if (uniqueDeps.has(depIdStr)) {
              log('debug', `Removing duplicate dependency from subtask ${task.id}.${subtask.id}: ${depId}`);
              return false;
            }
            uniqueDeps.add(depIdStr);
            return true;
          });
          
          if (subtask.dependencies.length < originalLength) {
            changesDetected = true;
          }
        }
      });
    }
  });
  
  return changesDetected;
}

/**
 * Clean up subtask dependencies by removing references to non-existent subtasks/tasks
 * @param {Object} tasksData - The tasks data object with tasks array
 * @returns {boolean} - True if any changes were made
 */
function cleanupSubtaskDependencies(tasksData) {
  if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
    return false;
  }
  
  log('debug', 'Cleaning up subtask dependencies...');
  
  let changesDetected = false;
  let duplicatesRemoved = 0;
  
  // Create validity maps for fast lookup
  const validTaskIds = new Set(tasksData.tasks.map(t => t.id));
  const validSubtaskIds = new Set();
  
  // Create a dependency map for cycle detection
  const subtaskDependencyMap = new Map();
  
  // Populate the validSubtaskIds set
  tasksData.tasks.forEach(task => {
    if (task.subtasks && Array.isArray(task.subtasks)) {
      task.subtasks.forEach(subtask => {
        validSubtaskIds.add(`${task.id}.${subtask.id}`);
      });
    }
  });
  
  // Clean up each task's subtasks
  tasksData.tasks.forEach(task => {
    if (!task.subtasks || !Array.isArray(task.subtasks)) {
      return;
    }
    
    task.subtasks.forEach(subtask => {
      if (!subtask.dependencies || !Array.isArray(subtask.dependencies)) {
        return;
      }
      
      const originalLength = subtask.dependencies.length;
      const subtaskId = `${task.id}.${subtask.id}`;
      
      // First remove duplicate dependencies
      const uniqueDeps = new Set();
      subtask.dependencies = subtask.dependencies.filter(depId => {
        // Convert to string for comparison, handling special case for subtask references
        let depIdStr = String(depId);
        
        // For numeric IDs that are likely subtask references in the same parent task
        if (typeof depId === 'number' && depId < 100) {
          depIdStr = `${task.id}.${depId}`;
        }
        
        if (uniqueDeps.has(depIdStr)) {
          log('debug', `Removing duplicate dependency from subtask ${subtaskId}: ${depId}`);
          duplicatesRemoved++;
          return false;
        }
        uniqueDeps.add(depIdStr);
        return true;
      });
      
      // Then filter invalid dependencies
      subtask.dependencies = subtask.dependencies.filter(depId => {
        // Handle string dependencies with dot notation
        if (typeof depId === 'string' && depId.includes('.')) {
          if (!validSubtaskIds.has(depId)) {
            log('debug', `Removing invalid subtask dependency from ${subtaskId}: ${depId}`);
            return false;
          }
          if (depId === subtaskId) {
            log('debug', `Removing self-dependency from ${subtaskId}`);
            return false;
          }
          return true;
        }
        
        // Handle numeric dependencies
        const numericId = typeof depId === 'number' ? depId : parseInt(depId, 10);
        
        // Small numbers likely refer to subtasks in the same task
        if (numericId < 100) {
          const fullSubtaskId = `${task.id}.${numericId}`;
          
          if (fullSubtaskId === subtaskId) {
            log('debug', `Removing self-dependency from ${subtaskId}`);
            return false;
          }
          
          if (!validSubtaskIds.has(fullSubtaskId)) {
            log('debug', `Removing invalid subtask dependency from ${subtaskId}: ${numericId}`);
            return false;
          }
          
          return true;
        }
        
        // Otherwise it's a task reference
        if (!validTaskIds.has(numericId)) {
          log('debug', `Removing invalid task dependency from ${subtaskId}: ${numericId}`);
          return false;
        }
        
        return true;
      });
      
      if (subtask.dependencies.length < originalLength) {
        changesDetected = true;
      }
      
      // Build dependency map for cycle detection
      subtaskDependencyMap.set(subtaskId, subtask.dependencies.map(depId => {
        if (typeof depId === 'string' && depId.includes('.')) {
          return depId;
        } else if (typeof depId === 'number' && depId < 100) {
          return `${task.id}.${depId}`;
        }
        return String(depId);
      }));
    });
  });
  
  // Break circular dependencies in subtasks
  tasksData.tasks.forEach(task => {
    if (!task.subtasks || !Array.isArray(task.subtasks)) {
      return;
    }
    
    task.subtasks.forEach(subtask => {
      const subtaskId = `${task.id}.${subtask.id}`;
      
      // Skip if no dependencies
      if (!subtask.dependencies || !Array.isArray(subtask.dependencies) || subtask.dependencies.length === 0) {
        return;
      }
      
      // Detect cycles for this subtask
      const visited = new Set();
      const recursionStack = new Set();
      const cyclesToBreak = findCycles(subtaskId, subtaskDependencyMap, visited, recursionStack);
      
      if (cyclesToBreak.length > 0) {
        const originalLength = subtask.dependencies.length;
        
        // Format cycle paths for removal
        const edgesToRemove = cyclesToBreak.map(edge => {
          if (edge.includes('.')) {
            const [depTaskId, depSubtaskId] = edge.split('.').map(Number);
            if (depTaskId === task.id) {
              return depSubtaskId; // Return just subtask ID if in the same task
            }
            return edge; // Full subtask ID string
          }
          return Number(edge); // Task ID
        });
        
        // Remove dependencies that cause cycles
        subtask.dependencies = subtask.dependencies.filter(depId => {
          const normalizedDepId = typeof depId === 'number' && depId < 100 
            ? `${task.id}.${depId}` 
            : String(depId);
            
          if (edgesToRemove.includes(depId) || edgesToRemove.includes(normalizedDepId)) {
            log('debug', `Breaking circular dependency: Removing ${normalizedDepId} from ${subtaskId}`);
            return false;
          }
          return true;
        });
        
        if (subtask.dependencies.length < originalLength) {
          changesDetected = true;
        }
      }
    });
  });
  
  if (changesDetected) {
    log('debug', `Cleaned up subtask dependencies (removed ${duplicatesRemoved} duplicates and fixed circular references)`);
  }
  
  return changesDetected;
}

/**
 * Ensure at least one subtask in each task has no dependencies
 * @param {Object} tasksData - The tasks data object with tasks array
 * @returns {boolean} - True if any changes were made
 */
function ensureAtLeastOneIndependentSubtask(tasksData) {
  if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
    return false;
  }
  
  let changesDetected = false;
  
  tasksData.tasks.forEach(task => {
    if (!task.subtasks || !Array.isArray(task.subtasks) || task.subtasks.length === 0) {
      return;
    }
    
    // Check if any subtask has no dependencies
    const hasIndependentSubtask = task.subtasks.some(st => 
      !st.dependencies || !Array.isArray(st.dependencies) || st.dependencies.length === 0
    );
    
    if (!hasIndependentSubtask) {
      // Find the first subtask and clear its dependencies
      if (task.subtasks.length > 0) {
        const firstSubtask = task.subtasks[0];
        log('debug', `Ensuring at least one independent subtask: Clearing dependencies for subtask ${task.id}.${firstSubtask.id}`);
        firstSubtask.dependencies = [];
        changesDetected = true;
      }
    }
  });
  
  return changesDetected;
}

// Add the function to display complexity report (around line ~4850, before the main function)
/**
 * Display the complexity analysis report in a nice format
 * @param {string} reportPath - Path to the complexity report file
 */
async function displayComplexityReport(reportPath) {
  displayBanner();
  
  // Check if the report exists
  if (!fs.existsSync(reportPath)) {
    console.log(boxen(
      chalk.yellow(`No complexity report found at ${reportPath}\n\n`) +
      'Would you like to generate one now?',
      { padding: 1, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question(chalk.cyan('Generate complexity report? (y/n): '), resolve);
    });
    readline.close();
    
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      // Call the analyze-complexity command
      console.log(chalk.blue('Generating complexity report...'));
      await analyzeTaskComplexity({ 
        output: reportPath,
        research: false, // Default to no research for speed
        file: 'tasks/tasks.json'
      });
      // Read the newly generated report
      return displayComplexityReport(reportPath);
    } else {
      console.log(chalk.yellow('Report generation cancelled.'));
      return;
    }
  }
  
  // Read the report
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    log('error', `Error reading complexity report: ${error.message}`);
    return;
  }
  
  // Display report header
  console.log(boxen(
    chalk.white.bold('Task Complexity Analysis Report'),
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));
  
  // Display metadata
  const metaTable = new Table({
    style: {
      head: [],
      border: [],
      'padding-top': 0,
      'padding-bottom': 0,
      compact: true
    },
    chars: {
      'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
    },
    colWidths: [20, 50]
  });
  
  metaTable.push(
    [chalk.cyan.bold('Generated:'), new Date(report.meta.generatedAt).toLocaleString()],
    [chalk.cyan.bold('Tasks Analyzed:'), report.meta.tasksAnalyzed],
    [chalk.cyan.bold('Threshold Score:'), report.meta.thresholdScore],
    [chalk.cyan.bold('Project:'), report.meta.projectName],
    [chalk.cyan.bold('Research-backed:'), report.meta.usedResearch ? 'Yes' : 'No']
  );
  
  console.log(metaTable.toString());
  
  // Sort tasks by complexity score (highest first)
  const sortedTasks = [...report.complexityAnalysis].sort((a, b) => b.complexityScore - a.complexityScore);
  
  // Determine which tasks need expansion based on threshold
  const tasksNeedingExpansion = sortedTasks.filter(task => task.complexityScore >= report.meta.thresholdScore);
  const simpleTasks = sortedTasks.filter(task => task.complexityScore < report.meta.thresholdScore);
  
  // Create progress bar to show complexity distribution
  const complexityDistribution = [0, 0, 0]; // Low (0-4), Medium (5-7), High (8-10)
  sortedTasks.forEach(task => {
    if (task.complexityScore < 5) complexityDistribution[0]++;
    else if (task.complexityScore < 8) complexityDistribution[1]++;
    else complexityDistribution[2]++;
  });
  
  const percentLow = Math.round((complexityDistribution[0] / sortedTasks.length) * 100);
  const percentMedium = Math.round((complexityDistribution[1] / sortedTasks.length) * 100);
  const percentHigh = Math.round((complexityDistribution[2] / sortedTasks.length) * 100);
  
  console.log(boxen(
    chalk.white.bold('Complexity Distribution\n\n') +
    `${chalk.green.bold('Low (1-4):')} ${complexityDistribution[0]} tasks (${percentLow}%)\n` +
    `${chalk.yellow.bold('Medium (5-7):')} ${complexityDistribution[1]} tasks (${percentMedium}%)\n` +
    `${chalk.red.bold('High (8-10):')} ${complexityDistribution[2]} tasks (${percentHigh}%)`,
    { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));
  
  // Create table for tasks that need expansion
  if (tasksNeedingExpansion.length > 0) {
    console.log(boxen(
      chalk.yellow.bold(`Tasks Recommended for Expansion (${tasksNeedingExpansion.length})`),
      { padding: { left: 2, right: 2, top: 0, bottom: 0 }, margin: { top: 1, bottom: 0 }, borderColor: 'yellow', borderStyle: 'round' }
    ));
    
    const complexTable = new Table({
      head: [
        chalk.yellow.bold('ID'), 
        chalk.yellow.bold('Title'), 
        chalk.yellow.bold('Score'),
        chalk.yellow.bold('Subtasks'),
        chalk.yellow.bold('Expansion Command')
      ],
      colWidths: [5, 40, 8, 10, 45],
      style: { head: [], border: [] }
    });
    
    tasksNeedingExpansion.forEach(task => {
      complexTable.push([
        task.taskId,
        truncate(task.taskTitle, 37),
        getComplexityWithColor(task.complexityScore),
        task.recommendedSubtasks,
        chalk.cyan(`node scripts/dev.js expand --id=${task.taskId} --num=${task.recommendedSubtasks}`)
      ]);
    });
    
    console.log(complexTable.toString());
  }
  
  // Create table for simple tasks
  if (simpleTasks.length > 0) {
    console.log(boxen(
      chalk.green.bold(`Simple Tasks (${simpleTasks.length})`),
      { padding: { left: 2, right: 2, top: 0, bottom: 0 }, margin: { top: 1, bottom: 0 }, borderColor: 'green', borderStyle: 'round' }
    ));
    
    const simpleTable = new Table({
      head: [
        chalk.green.bold('ID'), 
        chalk.green.bold('Title'), 
        chalk.green.bold('Score'),
        chalk.green.bold('Reasoning')
      ],
      colWidths: [5, 40, 8, 50],
      style: { head: [], border: [] }
    });
    
    simpleTasks.forEach(task => {
      simpleTable.push([
        task.taskId,
        truncate(task.taskTitle, 37),
        getComplexityWithColor(task.complexityScore),
        truncate(task.reasoning, 47)
      ]);
    });
    
    console.log(simpleTable.toString());
  }
  
  // Show action suggestions
  console.log(boxen(
    chalk.white.bold('Suggested Actions:') + '\n\n' +
    `${chalk.cyan('1.')} Expand all complex tasks: ${chalk.yellow(`node scripts/dev.js expand --all`)}\n` +
    `${chalk.cyan('2.')} Expand a specific task: ${chalk.yellow(`node scripts/dev.js expand --id=<id>`)}\n` +
    `${chalk.cyan('3.')} Regenerate with research: ${chalk.yellow(`node scripts/dev.js analyze-complexity --research`)}`,
    { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
  ));
}

// Helper function to get complexity score with appropriate color
function getComplexityWithColor(score) {
  if (score >= 8) {
    return chalk.red.bold(score);
  } else if (score >= 5) {
    return chalk.yellow(score);
  } else {
    return chalk.green(score);
  }
}

// Helper function to truncate text
function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}