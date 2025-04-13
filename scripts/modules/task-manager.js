/**
 * Task Manager Module
 * 
 * This module provides core task management functionality by re-exporting functions from dev.js
 * or implementing equivalent functionality for use by other modules.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { callLLMWithRetry } from './ai-services.js';
import { log, readJSON, writeJSON, archiveTasksBeforeOverwrite, restoreArchive } from './utils.js';
import readline from 'readline';

// Import required functionality from dev.js if possible
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validates and fixes any invalid dependencies in the tasks data
 * @param {Object} data - Tasks data object (containing tasks array)
 * @param {string} logPrefix - Optional prefix for log messages
 * @returns {boolean} - True if changes were made, false otherwise
 */
function validateAndFixDependencies(data, logPrefix = '') {
  if (!data || !data.tasks || !Array.isArray(data.tasks)) {
    log('warn', `${logPrefix}No valid tasks data found to validate dependencies`);
    return false;
  }
  
  const prefix = logPrefix ? `${logPrefix}: ` : '';
  let changesMade = false;
  
  // Build a set of all valid task IDs
  const validTaskIds = new Set(data.tasks.map(task => parseInt(task.id, 10)));
  
  // Check each task's dependencies
  data.tasks.forEach(task => {
    if (!task.dependencies) {
      task.dependencies = [];
      changesMade = true;
      return;
    }
    
    // Convert dependencies to array if it's not already
    if (!Array.isArray(task.dependencies)) {
      task.dependencies = [];
      changesMade = true;
      log('warn', `${prefix}Fixed non-array dependencies for task ${task.id}`);
      return;
    }
    
    // Check each dependency
    const validDependencies = [];
    task.dependencies.forEach(depId => {
      // Parse dependency ID as integer
      const dependencyId = parseInt(depId, 10);
      
      // Skip self-dependencies
      if (dependencyId === parseInt(task.id, 10)) {
        log('warn', `${prefix}Removed self-dependency for task ${task.id}`);
        changesMade = true;
        return;
      }
      
      // Check if dependency exists
      if (!validTaskIds.has(dependencyId)) {
        log('warn', `${prefix}Removed invalid dependency ${dependencyId} for task ${task.id}`);
        changesMade = true;
        return;
      }
      
      // Check for circular dependencies
      if (isCircularDependency(data.tasks, dependencyId, [parseInt(task.id, 10)])) {
        log('warn', `${prefix}Removed circular dependency ${dependencyId} for task ${task.id}`);
        changesMade = true;
        return;
      }
      
      // Add to valid dependencies
      validDependencies.push(dependencyId);
    });
    
    // Update dependencies to only include valid ones
    if (validDependencies.length !== task.dependencies.length) {
      task.dependencies = validDependencies;
      changesMade = true;
    }
  });
  
  return changesMade;
}

/**
 * Check if adding a dependency would create a circular reference
 * @param {Array} tasks - Array of task objects
 * @param {number} taskId - ID of the task to check for dependencies
 * @param {Array} chain - Chain of dependencies to check against
 * @returns {boolean} - True if circular dependency is found
 */
function isCircularDependency(tasks, taskId, chain = []) {
  // Find the task by ID
  const task = tasks.find(t => parseInt(t.id, 10) === taskId);
  if (!task) return false;
  
  // Check each of this task's dependencies
  for (const depId of task.dependencies || []) {
    const dependencyId = parseInt(depId, 10);
    
    // If this dependency is in our chain, we have a circular reference
    if (chain.includes(dependencyId)) {
      return true;
    }
    
    // Recursively check dependencies
    if (isCircularDependency(tasks, dependencyId, [...chain, dependencyId])) {
      return true;
    }
  }
  
  return false;
}

/**
 * Add a new task to the tasks.json file
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} prompt - Description of the task to create
 * @param {Array} dependencies - Array of task IDs this task depends on
 * @param {string} priority - Priority level for the task (high, medium, low)
 * @returns {Promise<Object>} The newly created task
 */
async function addTask(tasksPath, prompt, dependencies = [], priority = 'medium') {
  // Read existing tasks
  let data;
  try {
    data = readJSON(tasksPath);
  } catch (err) {
    log('error', `Error reading tasks file: ${err.message}`);
    // Create a new tasks structure if the file doesn't exist
    data = { tasks: [], metadata: { generatedAt: new Date().toISOString() } };
  }

  // Generate a new task ID
  const nextId = data.tasks.length > 0 
    ? Math.max(...data.tasks.map(t => typeof t.id === 'number' ? t.id : parseInt(t.id, 10))) + 1 
    : 1;

  // Generate task content using AI
  const model = process.env.MODEL || 'claude-3-opus-20240229';
  const taskData = await callLLMWithRetry({
    model,
    max_tokens: 1500,
    temperature: 0.7,
    system: `You are an expert software development task manager who specializes in breaking down tasks into clear, actionable items.`,
    messages: [
      {
        role: 'user',
        content: `Create a detailed task based on this description: "${prompt}"
        
        Format the task with the following fields:
        - title: A concise, clear title
        - description: A brief summary of what the task involves
        - details: Detailed implementation notes and technical requirements
        - testStrategy: How to verify this task is complete
        
        Return ONLY the JSON object for the task, properly formatted with these properties. Do not include explanations or markdown around the JSON.`
      }
    ]
  });

  // Parse the response and create the task object
  let task;
  try {
    // Ensure response.content is a string
    const responseContent = typeof taskData.content === 'string' 
      ? taskData.content 
      : JSON.stringify(taskData.content);

    // Extract JSON from the response (handle potential text before/after the JSON)
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      task = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not find valid JSON in the response');
    }

    // Add required fields
    task.id = nextId;
    task.status = 'pending';
    task.dependencies = dependencies;
    task.priority = priority || 'medium';

    // Add the task to the tasks array
    data.tasks.push(task);

    // Update the timestamp
    data.metadata.updatedAt = new Date().toISOString();

    // Save the updated tasks file
    writeJSON(tasksPath, data);

    log('info', `Task ${nextId} added successfully!`);
    return task;
  } catch (err) {
    log('error', `Error creating task: ${err.message}`);
    throw err;
  }
}

/**
 * Parse a PRD document to generate initial tasks
 * @param {string} prdPath - Path to the PRD document
 * @param {string} tasksPath - Path where tasks.json will be saved
 * @param {number} numTasks - Approximate number of tasks to generate
 * @param {Object} options - Additional options for the parsing process
 * @param {Object} aiClient - AI client for making calls
 * @param {Object} modelConfig - Configuration for the AI model
 * @returns {Promise<Object>} Generated tasks data
 */
async function parsePRD(prdPath, tasksPath, numTasks, options = {}, aiClient, modelConfig = {}) {
  try {
    // Check if the PRD file exists
    if (!fs.existsSync(prdPath)) {
      throw new Error(`PRD file not found at ${prdPath}`);
    }

    // Check if tasks.json already exists
    if (fs.existsSync(tasksPath)) {
      const forceFlag = options.force === true;
      const confirmOverwrite = process.env.FORCE_OVERWRITE === 'true' || forceFlag;
      
      if (!confirmOverwrite) {
        // Check if we're in a non-interactive environment
        const isNonInteractive = !process.stdin.isTTY;
        
        if (isNonInteractive) {
          // In non-interactive environments, we can't prompt, so throw the error
          throw new Error(`Tasks file already exists at ${tasksPath}. Use --force flag or set FORCE_OVERWRITE=true to overwrite.`);
        }
        
        // For interactive environments, ask the user for confirmation
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        try {
          const answer = await new Promise((resolve) => {
            rl.question(`Tasks file already exists at ${tasksPath}. Overwrite? (y/N): `, (answer) => {
              resolve(answer.toLowerCase());
              rl.close();
            });
          });
          
          if (answer !== 'y' && answer !== 'yes') {
            log('info', 'Task generation cancelled by user.');
            throw new Error('Task generation cancelled by user');
          }
          
          // User confirmed overwrite
          log('info', 'User confirmed overwrite of existing tasks file.');
        } catch (promptErr) {
          // If it's our cancellation error, re-throw it
          if (promptErr.message === 'Task generation cancelled by user') {
            throw promptErr;
          }
          // For other errors with the prompt, fall back to the original error
          throw new Error(`Tasks file already exists at ${tasksPath}. Use --force flag or set FORCE_OVERWRITE=true to overwrite.`);
        }
      }
      
      // Archive existing tasks before overwriting
      const archiveResult = archiveTasksBeforeOverwrite(tasksPath);
      if (!archiveResult.success) {
        log('warn', `Could not archive existing tasks file: ${archiveResult.error}. Proceeding with overwrite.`);
      } else if (archiveResult.archived) {
        log('info', `Existing tasks file has been archived to ${archiveResult.archivePath}`);
      }
    }

    // Read the PRD content
    const prdContent = fs.readFileSync(prdPath, 'utf8');
    if (!prdContent || prdContent.trim().length === 0) {
      throw new Error('PRD file is empty');
    }

    const mcpLog = options.mcpLog || null;
    const logInfo = message => {
      if (mcpLog) mcpLog.info(message);
      log('info', message);
    };
    
    // Call AI to generate tasks from PRD
    const model = modelConfig.model || process.env.MODEL || 'claude-3-opus-20240229';
    const systemPrompt = `You are a software development project manager with expertise in breaking down requirements into actionable development tasks. Your job is to analyze a Product Requirements Document (PRD) and create a comprehensive list of implementation tasks.`;
    
    logInfo(`Calling AI model ${model} to parse PRD and generate ${numTasks} tasks...`);
    
    // Use provided AI client or fallback to direct call
    let parsedData;
    if (aiClient) {
      const response = await aiClient.messages.create({
        model,
        max_tokens: modelConfig.maxTokens || 4000,
        temperature: modelConfig.temperature || 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Parse this PRD and create approximately ${numTasks} development tasks:

${prdContent}

For each task, include:
1. A concise title
2. A clear description
3. Detailed implementation notes
4. A test strategy to verify the implementation
5. A priority level (high, medium, low)
6. Dependencies on other tasks (if any)

Return ONLY a JSON array with the tasks. Each task should have these properties: title, description, details, testStrategy, priority, and dependencies (array of task indexes, starting from 0).`
          }
        ]
      });
      // Ensure response.content is properly handled as a string
      parsedData = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    } else {
      // Fallback to callLLMWithRetry
      const response = await callLLMWithRetry({
        model,
        max_tokens: 4000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Parse this PRD and create approximately ${numTasks} development tasks:

${prdContent}

For each task, include:
1. A concise title
2. A clear description
3. Detailed implementation notes
4. A test strategy to verify the implementation
5. A priority level (high, medium, low)
6. Dependencies on other tasks (if any)

Return ONLY a JSON array with the tasks. Each task should have these properties: title, description, details, testStrategy, priority, and dependencies (array of task indexes, starting from 0).`
          }
        ]
      });
      // Ensure response.content is properly handled as a string
      parsedData = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    }

    // Process the response to extract JSON
    let tasksArray;
    try {
      // Check if parsedData is already an object (may happen with parallel processing)
      if (typeof parsedData === 'object' && parsedData !== null) {
        if (Array.isArray(parsedData)) {
          // It's already an array, use it directly
          tasksArray = parsedData;
        } else if (parsedData.content) {
          // It's an object with a content property (typical API response format)
          const contentStr = String(parsedData.content);
          const jsonMatch = contentStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (jsonMatch) {
            tasksArray = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Could not find valid JSON array in the response content');
          }
        } else {
          // Try to stringify and re-parse to normalize the object
          const jsonStr = JSON.stringify(parsedData);
          const jsonMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (jsonMatch) {
            tasksArray = JSON.parse(jsonMatch[0]);
          } else {
            // If that fails, see if the object itself is usable
            if (Object.keys(parsedData).includes('0')) {
              // Might be an array-like object, convert to array
              tasksArray = Object.values(parsedData);
            } else {
              throw new Error('Response object does not contain a valid task array');
            }
          }
        }
      } else {
        // Original string-based approach
        const dataStr = String(parsedData || '');
        const jsonMatch = dataStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          tasksArray = JSON.parse(jsonMatch[0]);
        } else {
          // Last resort: try to parse the entire string as JSON
          try {
            const possibleJson = JSON.parse(dataStr);
            if (Array.isArray(possibleJson)) {
              tasksArray = possibleJson;
            } else {
              throw new Error('Could not find valid JSON array in the response');
            }
          } catch (jsonErr) {
            throw new Error('Could not find valid JSON array in the response');
          }
        }
      }
      
      // Make sure we have a valid array at this point
      if (!Array.isArray(tasksArray) || tasksArray.length === 0) {
        throw new Error('No valid tasks found in the response');
      }
      
      // Debug log of the data we got
      log('debug', `Found ${tasksArray.length} tasks in the response`);
      
    } catch (err) {
      // Add more context to the error for debugging
      const dataType = typeof parsedData;
      const dataPreview = dataType === 'string' 
        ? parsedData.substring(0, 100) + '...' 
        : dataType === 'object' 
          ? JSON.stringify(parsedData).substring(0, 100) + '...' 
          : String(parsedData);
          
      throw new Error(`Error parsing AI response: ${err.message}. Data type: ${dataType}, Preview: ${dataPreview}`);
    }

    // Validate and format tasks
    const formattedTasks = tasksArray.map((task, index) => ({
      id: index + 1,
      title: task.title,
      description: task.description,
      details: task.details,
      testStrategy: task.testStrategy,
      priority: task.priority || 'medium',
      status: 'pending',
      dependencies: Array.isArray(task.dependencies) 
        ? task.dependencies.map(depIndex => depIndex + 1) // Convert 0-based to 1-based indexes
        : []
    }));

    // Create tasks data structure
    const tasksData = {
      tasks: formattedTasks,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'prd-parser',
        prdFile: path.basename(prdPath)
      }
    };

    // Validate and fix dependencies in the generated tasks
    const dependencyChanges = validateAndFixDependencies(tasksData, 'parsePRD');
    if (dependencyChanges) {
      log('info', "Fixed some invalid dependencies in the generated tasks");
    } else {
      log('info', "All dependencies in generated tasks are valid");
    }

    // Ensure the directory exists
    const tasksDir = path.dirname(tasksPath);
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }

    // Write the tasks to the file - Make sure we're writing a proper object, not an array
    writeJSON(tasksPath, tasksData);

    logInfo(`Successfully generated ${formattedTasks.length} tasks from PRD`);
    return tasksData;
  } catch (err) {
    log('error', `Error parsing PRD: ${err.message}`);
    throw err;
  }
}

/**
 * List archived tasks and PRD files
 * @param {string} projectRoot - Path to the project root
 * @returns {Object} - Object containing list of archived tasks and PRDs with their timestamps
 */
async function listArchives(projectRoot) {
  try {
    const results = {
      tasks: [],
      prds: []
    };
    
    // Check for task archives
    const tasksArchiveDir = path.join(projectRoot, 'tasks', 'archives');
    if (fs.existsSync(tasksArchiveDir)) {
      const files = fs.readdirSync(tasksArchiveDir);
      
      files.forEach(file => {
        if (file.startsWith('tasks-')) {
          const filePath = path.join(tasksArchiveDir, file);
          const stats = fs.statSync(filePath);
          
          // Extract timestamp from filename
          let timestamp = file.replace('tasks-', '').replace('.json', '');
          
          // Try to parse it into a readable date
          try {
            const date = new Date(timestamp.replace(/-/g, ':'));
            timestamp = date.toLocaleString();
          } catch (e) {
            // Keep original if parsing fails
          }
          
          results.tasks.push({
            filename: file,
            path: filePath,
            timestamp,
            size: stats.size,
            dateCreated: stats.birthtime
          });
        }
      });
      
      // Sort by creation time (newest first)
      results.tasks.sort((a, b) => b.dateCreated - a.dateCreated);
    }
    
    // Check for PRD archives
    const scriptsArchiveDir = path.join(projectRoot, 'scripts', 'archives');
    if (fs.existsSync(scriptsArchiveDir)) {
      const files = fs.readdirSync(scriptsArchiveDir);
      
      files.forEach(file => {
        if (file.startsWith('prd-')) {
          const filePath = path.join(scriptsArchiveDir, file);
          const stats = fs.statSync(filePath);
          
          // Extract timestamp from filename
          let timestamp = file.replace('prd-', '').replace('.txt', '');
          
          // Try to parse it into a readable date
          try {
            const date = new Date(timestamp.replace(/-/g, ':'));
            timestamp = date.toLocaleString();
          } catch (e) {
            // Keep original if parsing fails
          }
          
          results.prds.push({
            filename: file,
            path: filePath,
            timestamp,
            size: stats.size,
            dateCreated: stats.birthtime
          });
        }
      });
      
      // Sort by creation time (newest first)
      results.prds.sort((a, b) => b.dateCreated - a.dateCreated);
    }
    
    return results;
  } catch (err) {
    log('error', `Error listing archives: ${err.message}`);
    throw err;
  }
}

/**
 * Analyze task complexity and generate expansion recommendations
 * @param {Object} options - Options for the analysis
 * @param {string} [options.file] - Path to the tasks file
 * @param {string} [options.output] - Output file path for the report
 * @param {string} [options.model] - LLM model to use for analysis
 * @param {number|string} [options.threshold] - Minimum complexity score to recommend expansion (1-10)
 * @param {boolean} [options.research] - Use Perplexity AI for research-backed analysis
 * @param {Object} [context] - Context object containing session and logging data
 * @returns {Promise<Object>} Generated complexity report
 */
async function analyzeTaskComplexity(options, context = {}) {
  try {
    const { file = 'tasks/tasks.json', output = 'scripts/task-complexity-report.json', model, threshold = 5, research = false } = options;
    
    // Set up logging - use provided logger or fallback to console
    const log = (context.mcpLog || {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug || console.log,
      success: console.log
    });
    
    log.info(`Analyzing task complexity from: ${file}`);
    log.info(`Output report will be saved to: ${output}`);
    
    if (research) {
      log.info('Using Perplexity AI for research-backed complexity analysis');
    }
    
    // Validate input file
    if (!fs.existsSync(file)) {
      throw new Error(`Tasks file not found at ${file}`);
    }
    
    // Read the tasks file
    const data = readJSON(file);
    if (!data || !data.tasks || !Array.isArray(data.tasks)) {
      throw new Error('No valid tasks found in tasks.json');
    }
    
    // Generate prompt for analysis
    const systemPrompt = `You are an expert software architect and project manager. Your task is to analyze the complexity of development tasks and determine how many subtasks each should be broken down into.`;
    
    const userPrompt = `
Analyze the complexity of each development task below. For each task:
1. Assess its complexity on a scale of 1-10
2. Recommend the optimal number of subtasks (between 3-8)
3. Suggest a specific prompt that would help generate good subtasks for this task
4. Explain your reasoning briefly

Tasks:
${data.tasks.map(task => `
ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details || 'N/A'}
Dependencies: ${JSON.stringify(task.dependencies || [])}
Priority: ${task.priority || 'medium'}
`).join('\n---\n')}

Analyze each task and return a JSON array with the following structure for each task:
[
  {
    "taskId": number,
    "taskTitle": string,
    "complexityScore": number (1-10),
    "recommendedSubtasks": number (3-8),
    "expansionPrompt": string (a specific prompt for generating good subtasks),
    "reasoning": string (brief explanation of your assessment)
  },
  ...
]

IMPORTANT: Make sure to include an analysis for EVERY task listed above, with the correct taskId matching each task's ID.
`;
    
    // Starting the analysis process
    log.info('Starting task complexity analysis...');
    
    // Select the appropriate AI client based on options
    let analysisResponse;
    if (research) {
      // Use Perplexity for research-backed analysis if available
      try {
        // Check if Perplexity API key is available
        if (!process.env.PERPLEXITY_API_KEY) {
          throw new Error('PERPLEXITY_API_KEY not found in environment variables');
        }
        
        const perplexityModel = process.env.PERPLEXITY_MODEL || 'sonar-small-online';
        
        // Import OpenAI dynamically if needed
        const OpenAI = (await import('openai')).default;
        const perplexity = new OpenAI({
          apiKey: process.env.PERPLEXITY_API_KEY,
          baseURL: 'https://api.perplexity.ai'
        });
        
        log.info(`Using Perplexity AI with model ${perplexityModel} for research-backed analysis`);
        
        analysisResponse = await perplexity.chat.completions.create({
          model: perplexityModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 4000
        });
      } catch (error) {
        log.warn(`Error using Perplexity AI: ${error.message}`);
        log.warn('Falling back to default AI service...');
        analysisResponse = await callLLMWithRetry({
          model: model || process.env.MODEL || 'claude-3-opus-20240229',
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          temperature: 0.2,
          max_tokens: 4000
        });
      }
    } else {
      // Use default AI service
      analysisResponse = await callLLMWithRetry({
        model: model || process.env.MODEL || 'claude-3-opus-20240229',
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.2,
        max_tokens: 4000
      });
    }
    
    // Parse the response to extract the JSON analysis
    let analysisData;
    try {
      // Handle different response formats
      const responseContent = typeof analysisResponse.content === 'string' 
        ? analysisResponse.content 
        : JSON.stringify(analysisResponse.content);
      
      // Extract JSON from the response
      const jsonMatch = responseContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not find valid JSON array in the response');
      }
    } catch (err) {
      throw new Error(`Failed to parse analysis response: ${err.message}`);
    }
    
    // Validate the threshold value
    const thresholdValue = parseInt(threshold, 10) || 5;
    if (isNaN(thresholdValue) || thresholdValue < 1 || thresholdValue > 10) {
      log.warn(`Invalid threshold value: ${threshold}, using default of 5`);
    }
    
    // Generate expansion commands for tasks meeting the threshold
    analysisData.forEach(task => {
      // Create a suggested expansion command for each high-complexity task
      const complexity = parseInt(task.complexityScore, 10);
      const numSubtasks = parseInt(task.recommendedSubtasks, 10);
      
      if (complexity >= thresholdValue) {
        const sanitizedPrompt = task.expansionPrompt.replace(/"/g, '\\"');
        task.expansionCommand = `task-master expand --id=${task.taskId} --num=${numSubtasks} --prompt="${sanitizedPrompt}"${research ? ' --research' : ''}`;
      }
    });
    
    // Create the output report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        taskCount: data.tasks.length,
        thresholdValue,
        model: model || process.env.MODEL || 'claude-3-opus-20240229',
        researchBacked: research
      },
      complexityAnalysis: analysisData
    };
    
    // Ensure the output directory exists
    const outputDir = path.dirname(output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the report to the output file
    writeJSON(output, report);
    
    log.info(`Task complexity analysis complete. Report saved to ${output}`);
    
    // Count tasks by complexity category
    const highComplexityTasks = analysisData.filter(t => t.complexityScore >= 8).length;
    const mediumComplexityTasks = analysisData.filter(t => t.complexityScore >= 5 && t.complexityScore < 8).length;
    const lowComplexityTasks = analysisData.filter(t => t.complexityScore < 5).length;
    
    log.info('Complexity Distribution:');
    log.info(`- High (8-10): ${highComplexityTasks} tasks`);
    log.info(`- Medium (5-7): ${mediumComplexityTasks} tasks`);
    log.info(`- Low (1-4): ${lowComplexityTasks} tasks`);
    
    return report;
  } catch (error) {
    // Re-throw with a clear message
    throw new Error(`Error in analyzeTaskComplexity: ${error.message}`);
  }
}

// Export functions
export { addTask, parsePRD, listArchives, restoreArchive, validateAndFixDependencies, isCircularDependency, analyzeTaskComplexity };
