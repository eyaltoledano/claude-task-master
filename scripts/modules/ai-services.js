/**
 * ai-services.js
 * AI service interactions for the Task Master CLI
 */

// NOTE/TODO: Include the beta header output-128k-2025-02-19 in your API request to increase the maximum output token length to 128k tokens for Claude 3.7 Sonnet.

import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { CONFIG, log, sanitizePrompt } from './utils.js';
import { startLoadingIndicator, stopLoadingIndicator } from './ui.js';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Configure Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Add beta header for 128k token output
  defaultHeaders: {
    'anthropic-beta': 'output-128k-2025-02-19'
  }
});

// Lazy-loaded Perplexity client
let perplexity = null;

/**
 * Get or initialize the Perplexity client
 * @returns {OpenAI} Perplexity client
 */
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

/**
 * Get the best available AI model for a given operation
 * @param {Object} options - Options for model selection
 * @param {boolean} options.claudeOverloaded - Whether Claude is currently overloaded
 * @param {boolean} options.requiresResearch - Whether the operation requires research capabilities
 * @returns {Object} Selected model info with type and client
 */
function getAvailableAIModel(options = {}) {
  const { claudeOverloaded = false, requiresResearch = false } = options;
  
  // First choice: Perplexity if research is required and it's available
  if (requiresResearch && process.env.PERPLEXITY_API_KEY) {
    try {
      const client = getPerplexityClient();
      return { type: 'perplexity', client };
    } catch (error) {
      log('warn', `Perplexity not available: ${error.message}`);
      // Fall through to Claude
    }
  }
  
  // Second choice: Claude if not overloaded
  if (!claudeOverloaded && process.env.ANTHROPIC_API_KEY) {
    return { type: 'claude', client: anthropic };
  }
  
  // Third choice: Perplexity as Claude fallback (even if research not required)
  if (process.env.PERPLEXITY_API_KEY) {
    try {
      const client = getPerplexityClient();
      log('info', 'Claude is overloaded, falling back to Perplexity');
      return { type: 'perplexity', client };
    } catch (error) {
      log('warn', `Perplexity fallback not available: ${error.message}`);
      // Fall through to Claude anyway with warning
    }
  }
  
  // Last resort: Use Claude even if overloaded (might fail)
  if (process.env.ANTHROPIC_API_KEY) {
    if (claudeOverloaded) {
      log('warn', 'Claude is overloaded but no alternatives are available. Proceeding with Claude anyway.');
    }
    return { type: 'claude', client: anthropic };
  }
  
  // No models available
  throw new Error('No AI models available. Please set ANTHROPIC_API_KEY and/or PERPLEXITY_API_KEY.');
}

/**
 * Handle Claude API errors with user-friendly messages
 * @param {Error} error - The error from Claude API
 * @returns {string} User-friendly error message
 */
function handleClaudeError(error) {
  // Check if it's a structured error response
  if (error.type === 'error' && error.error) {
    switch (error.error.type) {
      case 'overloaded_error':
        // Check if we can use Perplexity as a fallback
        if (process.env.PERPLEXITY_API_KEY) {
          return 'Claude is currently overloaded. Trying to fall back to Perplexity AI.';
        }
        return 'Claude is currently experiencing high demand and is overloaded. Please wait a few minutes and try again.';
      case 'rate_limit_error':
        return 'You have exceeded the rate limit. Please wait a few minutes before making more requests.';
      case 'invalid_request_error':
        return 'There was an issue with the request format. If this persists, please report it as a bug.';
      default:
        return `Claude API error: ${error.error.message}`;
    }
  }
  
  // Check for network/timeout errors
  if (error.message?.toLowerCase().includes('timeout')) {
    return 'The request to Claude timed out. Please try again.';
  }
  if (error.message?.toLowerCase().includes('network')) {
    return 'There was a network error connecting to Claude. Please check your internet connection and try again.';
  }
  
  // Default error message
  return `Error communicating with Claude: ${error.message}`;
}

/**
 * Call Claude to generate tasks from a PRD
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} retryCount - Retry count
 * @param {Object} options - Options object containing:
 *   - reportProgress: Function to report progress to MCP server (optional)
 *   - mcpLog: MCP logger object (optional)
 *   - session: Session object from MCP server (optional)
 * @returns {Object} Claude's response
 */
async function callClaude(prdContent, prdPath, numTasks, retryCount = 0, { reportProgress, mcpLog, session } = {}) {
  try {
    log('info', 'Calling Claude...');
    
    // Build the system prompt
    const systemPrompt = `You are an AI assistant helping to break down a Product Requirements Document (PRD) into a set of sequential development tasks. 
Your goal is to create ${numTasks} well-structured, actionable development tasks based on the PRD provided.

Each task should follow this JSON structure:
{
  "id": number,
  "title": string,
  "description": string,
  "status": "pending",
  "dependencies": number[] (IDs of tasks this depends on),
  "priority": "high" | "medium" | "low",
  "details": string (implementation details),
  "testStrategy": string (validation approach)
}

Guidelines:
1. Create exactly ${numTasks} tasks, numbered from 1 to ${numTasks}
2. Each task should be atomic and focused on a single responsibility
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field
9. If the PRD contains specific requirements for libraries, database schemas, frameworks, tech stacks, or any other implementation details, STRICTLY ADHERE to these requirements in your task breakdown and do not discard them under any circumstance
10. Focus on filling in any gaps left by the PRD or areas that aren't fully specified, while preserving all explicit requirements
11. Always aim to provide the most direct path to implementation, avoiding over-engineering or roundabout approaches

Expected output format:
{
  "tasks": [
    {
      "id": 1,
      "title": "Setup Project Repository",
      "description": "...",
      ...
    },
    ...
  ],
  "metadata": {
    "projectName": "PRD Implementation",
    "totalTasks": ${numTasks},
    "sourceFile": "${prdPath}",
    "generatedAt": "YYYY-MM-DD"
  }
}

Important: Your response must be valid JSON only, with no additional explanation or comments.`;

    // Use streaming request to handle large responses and show progress
    return await handleStreamingRequest(prdContent, prdPath, numTasks, CONFIG.maxTokens, systemPrompt, { reportProgress, mcpLog, session } = {});
  } catch (error) {
    // Get user-friendly error message
    const userMessage = handleClaudeError(error);
    log('error', userMessage);

    // Retry logic for certain errors
    if (retryCount < 2 && (
      error.error?.type === 'overloaded_error' || 
      error.error?.type === 'rate_limit_error' ||
      error.message?.toLowerCase().includes('timeout') ||
      error.message?.toLowerCase().includes('network')
    )) {
      const waitTime = (retryCount + 1) * 5000; // 5s, then 10s
      log('info', `Waiting ${waitTime/1000} seconds before retry ${retryCount + 1}/2...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return await callClaude(prdContent, prdPath, numTasks, retryCount + 1);
    } else {
      console.error(chalk.red(userMessage));
      if (CONFIG.debug) {
        log('debug', 'Full error:', error);
      }
      throw new Error(userMessage);
    }
  }
}

/**
 * Handle streaming request to Claude
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} maxTokens - Maximum tokens
 * @param {string} systemPrompt - System prompt
 * @param {Object} options - Options object containing:
 *   - reportProgress: Function to report progress to MCP server (optional)
 *   - mcpLog: MCP logger object (optional)
 *   - session: Session object from MCP server (optional)
 * @returns {Object} Claude's response
 */
async function handleStreamingRequest(prdContent, prdPath, numTasks, maxTokens, systemPrompt, { reportProgress, mcpLog, session } = {}) {
  const loadingIndicator = startLoadingIndicator('Generating tasks from PRD...');
  if (reportProgress) { await reportProgress({ progress: 0 }); }
  let responseText = '';
  let streamingInterval = null;
  
  try {
    // Use streaming for handling large responses
    const stream = await anthropic.messages.create({
      model: session?.env?.ANTHROPIC_MODEL || CONFIG.model,
      max_tokens: session?.env?.MAX_TOKENS || maxTokens,
      temperature: session?.env?.TEMPERATURE || CONFIG.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here's the Product Requirements Document (PRD) to break down into ${numTasks} tasks:\n\n${prdContent}`
        }
      ],
      stream: true
    });
    
    // Update loading indicator to show streaming progress
    let dotCount = 0;
    const readline = await import('readline');
    streamingInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
      dotCount = (dotCount + 1) % 4;
    }, 500);
    
    // Process the stream
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        responseText += chunk.delta.text;
      }
      if (reportProgress) {
        await reportProgress({ progress: (responseText.length / maxTokens) * 100 });
      }
      if (mcpLog) {
        mcpLog.info(`Progress: ${responseText.length / maxTokens * 100}%`);
      }
    }
    
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    log('info', "Completed streaming response from Claude API!");
    
    return processClaudeResponse(responseText, numTasks, 0, prdContent, prdPath);
  } catch (error) {
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    // Get user-friendly error message
    const userMessage = handleClaudeError(error);
    log('error', userMessage);
    console.error(chalk.red(userMessage));
    
    if (CONFIG.debug) {
      log('debug', 'Full error:', error);
    }
    
    throw new Error(userMessage);
  }
}

/**
 * Process Claude's response
 * @param {string} textContent - Text content from Claude
 * @param {number} numTasks - Number of tasks
 * @param {number} retryCount - Retry count
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @returns {Object} Processed response
 */
function processClaudeResponse(textContent, numTasks, retryCount, prdContent, prdPath) {
  try {
    // Attempt to parse the JSON response
    let jsonStart = textContent.indexOf('{');
    let jsonEnd = textContent.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Could not find valid JSON in Claude's response");
    }
    
    let jsonContent = textContent.substring(jsonStart, jsonEnd + 1);
    let parsedData = JSON.parse(jsonContent);
    
    // Validate the structure of the generated tasks
    if (!parsedData.tasks || !Array.isArray(parsedData.tasks)) {
      throw new Error("Claude's response does not contain a valid tasks array");
    }
    
    // Ensure we have the correct number of tasks
    if (parsedData.tasks.length !== numTasks) {
      log('warn', `Expected ${numTasks} tasks, but received ${parsedData.tasks.length}`);
    }
    
    // Add metadata if missing
    if (!parsedData.metadata) {
      parsedData.metadata = {
        projectName: "PRD Implementation",
        totalTasks: parsedData.tasks.length,
        sourceFile: prdPath,
        generatedAt: new Date().toISOString().split('T')[0]
      };
    }
    
    return parsedData;
  } catch (error) {
    log('error', "Error processing Claude's response:", error.message);
    
    // Retry logic
    if (retryCount < 2) {
      log('info', `Retrying to parse response (${retryCount + 1}/2)...`);
      
      // Try again with Claude for a cleaner response
      if (retryCount === 1) {
        log('info', "Calling Claude again for a cleaner response...");
        return callClaude(prdContent, prdPath, numTasks, retryCount + 1);
      }
      
      return processClaudeResponse(textContent, numTasks, retryCount + 1, prdContent, prdPath);
    } else {
      throw error;
    }
  }
}

/**
 * Generate subtasks for a task
 * @param {Object} task - Task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next subtask ID
 * @param {string} additionalContext - Additional context
 * @param {Object} options - Options object containing:
 *   - reportProgress: Function to report progress to MCP server (optional)
 *   - mcpLog: MCP logger object (optional)
 *   - session: Session object from MCP server (optional)
 * @returns {Array} Generated subtasks
 */
async function generateSubtasks(task, numSubtasks, nextSubtaskId, additionalContext = '', { reportProgress, mcpLog, session } = {}) {
  try {
    log('info', `Generating ${numSubtasks} subtasks for task ${task.id}: ${task.title}`);
    
    const loadingIndicator = startLoadingIndicator(`Generating subtasks for task ${task.id}...`);
    let streamingInterval = null;
    let responseText = '';
    
    const systemPrompt = `You are an AI assistant helping with task breakdown for software development. 
You need to break down a high-level task into ${numSubtasks} specific subtasks that can be implemented one by one.

Subtasks should:
1. Be specific and actionable implementation steps
2. Follow a logical sequence
3. Each handle a distinct part of the parent task
4. Include clear guidance on implementation approach
5. Have appropriate dependency chains between subtasks
6. Collectively cover all aspects of the parent task

For each subtask, provide:
- A clear, specific title
- Detailed implementation steps
- Dependencies on previous subtasks
- Testing approach

Each subtask should be implementable in a focused coding session.`;

    const contextPrompt = additionalContext ? 
      `\n\nAdditional context to consider: ${additionalContext}` : '';
    
    const userPrompt = `Please break down this task into ${numSubtasks} specific, actionable subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Current details: ${task.details || 'None provided'}
${contextPrompt}

Return exactly ${numSubtasks} subtasks with the following JSON structure:
[
  {
    "id": ${nextSubtaskId},
    "title": "First subtask title",
    "description": "Detailed description",
    "dependencies": [], 
    "details": "Implementation details"
  },
  ...more subtasks...
]

Note on dependencies: Subtasks can depend on other subtasks with lower IDs. Use an empty array if there are no dependencies.`;

    try {
      // Update loading indicator to show streaming progress
      let dotCount = 0;
      const readline = await import('readline');
      streamingInterval = setInterval(() => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`Generating subtasks for task ${task.id}${'.'.repeat(dotCount)}`);
        dotCount = (dotCount + 1) % 4;
      }, 500);

      // TODO: MOVE THIS TO THE STREAM REQUEST FUNCTION (DRY)
      
      // Use streaming API call
      const stream = await anthropic.messages.create({
        model: session?.env?.ANTHROPIC_MODEL || CONFIG.model,
        max_tokens: session?.env?.MAX_TOKENS || CONFIG.maxTokens,
        temperature: session?.env?.TEMPERATURE || CONFIG.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ],
        stream: true
      });
      
      // Process the stream
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
          responseText += chunk.delta.text;
        }
        if (reportProgress) {
          await reportProgress({ progress: (responseText.length / CONFIG.maxTokens) * 100 });
        }
        if (mcpLog) {
          mcpLog.info(`Progress: ${responseText.length / CONFIG.maxTokens * 100}%`);
        }
      }
      
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      
      log('info', `Completed generating subtasks for task ${task.id}`);
      
      return parseSubtasksFromText(responseText, nextSubtaskId, numSubtasks, task.id);
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log('error', `Error generating subtasks: ${error.message}`);
    throw error;
  }
}

/**
 * Generate subtasks with research from Perplexity
 * @param {Object} task - Task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next subtask ID
 * @param {string} additionalContext - Additional context
 * @param {Object} options - Options object containing:
 *   - reportProgress: Function to report progress to MCP server (optional)
 *   - mcpLog: MCP logger object (optional)
 *   - session: Session object from MCP server (optional)
 * @returns {Array} Generated subtasks
 */
async function generateSubtasksWithPerplexity(task, numSubtasks = 3, nextSubtaskId = 1, additionalContext = '', { reportProgress, mcpLog, session } = {}) {
  try {
    // First, perform research to get context
    log('info', `Researching context for task ${task.id}: ${task.title}`);
    const perplexityClient = getPerplexityClient();
    
    const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || session?.env?.PERPLEXITY_MODEL || 'sonar-pro';
    const researchLoadingIndicator = startLoadingIndicator('Researching best practices with Perplexity AI...');
    
    // Formulate research query based on task
    const researchQuery = `I need to implement "${task.title}" which involves: "${task.description}". 
What are current best practices, libraries, design patterns, and implementation approaches? 
Include concrete code examples and technical considerations where relevant.`;
    
    // Query Perplexity for research
    const researchResponse = await perplexityClient.chat.completions.create({
      model: PERPLEXITY_MODEL,
      messages: [{
        role: 'user',
        content: researchQuery
      }],
      temperature: 0.1 // Lower temperature for more factual responses
    });
    
    const researchResult = researchResponse.choices[0].message.content;
    
    stopLoadingIndicator(researchLoadingIndicator);
    log('info', 'Research completed, now generating subtasks with additional context');
    
    // Use the research result as additional context for Claude to generate subtasks
    const combinedContext = `
RESEARCH FINDINGS:
${researchResult}

ADDITIONAL CONTEXT PROVIDED BY USER:
${additionalContext || "No additional context provided."}
`;
    
    // Now generate subtasks with Claude
    const loadingIndicator = startLoadingIndicator(`Generating research-backed subtasks for task ${task.id}...`);
    let streamingInterval = null;
    let responseText = '';
    
    const systemPrompt = `You are an AI assistant helping with task breakdown for software development.
You need to break down a high-level task into ${numSubtasks} specific subtasks that can be implemented one by one.

You have been provided with research on current best practices and implementation approaches.
Use this research to inform and enhance your subtask breakdown.

Subtasks should:
1. Be specific and actionable implementation steps
2. Follow a logical sequence
3. Each handle a distinct part of the parent task
4. Include clear guidance on implementation approach
5. Have appropriate dependency chains between subtasks
6. Collectively cover all aspects of the parent task

For each subtask, provide:
- A clear, specific title
- Detailed implementation steps that incorporate best practices from the research
- Dependencies on previous subtasks
- Testing approach

Each subtask should be implementable in a focused coding session.`;

    const userPrompt = `Please break down this task into ${numSubtasks} specific, well-researched, actionable subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Current details: ${task.details || 'None provided'}

${combinedContext}

Return exactly ${numSubtasks} subtasks with the following JSON structure:
[
  {
    "id": ${nextSubtaskId},
    "title": "First subtask title",
    "description": "Detailed description incorporating research",
    "dependencies": [], 
    "details": "Implementation details with best practices"
  },
  ...more subtasks...
]

Note on dependencies: Subtasks can depend on other subtasks with lower IDs. Use an empty array if there are no dependencies.`;

    try {
      // Update loading indicator to show streaming progress
      let dotCount = 0;
      const readline = await import('readline');
      streamingInterval = setInterval(() => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`Generating research-backed subtasks for task ${task.id}${'.'.repeat(dotCount)}`);
        dotCount = (dotCount + 1) % 4;
      }, 500);
      
      // Use streaming API call
      const stream = await anthropic.messages.create({
        model: session?.env?.ANTHROPIC_MODEL || CONFIG.model,
        max_tokens: session?.env?.MAX_TOKENS || CONFIG.maxTokens,
        temperature: session?.env?.TEMPERATURE || CONFIG.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ],
        stream: true
      });
      
      // Process the stream
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
          responseText += chunk.delta.text;
        }
        if (reportProgress) {
          await reportProgress({ progress: (responseText.length / CONFIG.maxTokens) * 100 });
        }
        if (mcpLog) {
          mcpLog.info(`Progress: ${responseText.length / CONFIG.maxTokens * 100}%`);
        }
      }
      
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      
      log('info', `Completed generating research-backed subtasks for task ${task.id}`);
      
      return parseSubtasksFromText(responseText, nextSubtaskId, numSubtasks, task.id);
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log('error', `Error generating research-backed subtasks: ${error.message}`);
    throw error;
  }
}

/**
 * Parse subtasks from Claude's response text
 * @param {string} text - Response text
 * @param {number} startId - Starting subtask ID
 * @param {number} expectedCount - Expected number of subtasks
 * @param {number} parentTaskId - Parent task ID
 * @returns {Array} Parsed subtasks
 */
function parseSubtasksFromText(text, startId, expectedCount, parentTaskId) {
  try {
    // Locate JSON array in the text
    const jsonStartIndex = text.indexOf('[');
    const jsonEndIndex = text.lastIndexOf(']');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) {
      throw new Error("Could not locate valid JSON array in the response");
    }
    
    // Extract and parse the JSON
    const jsonText = text.substring(jsonStartIndex, jsonEndIndex + 1);
    let subtasks = JSON.parse(jsonText);
    
    // Validate
    if (!Array.isArray(subtasks)) {
      throw new Error("Parsed content is not an array");
    }
    
    // Log warning if count doesn't match expected
    if (subtasks.length !== expectedCount) {
      log('warn', `Expected ${expectedCount} subtasks, but parsed ${subtasks.length}`);
    }
    
    // Normalize subtask IDs if they don't match
    subtasks = subtasks.map((subtask, index) => {
      // Assign the correct ID if it doesn't match
      if (subtask.id !== startId + index) {
        log('warn', `Correcting subtask ID from ${subtask.id} to ${startId + index}`);
        subtask.id = startId + index;
      }
      
      // Convert dependencies to numbers if they are strings
      if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
        subtask.dependencies = subtask.dependencies.map(dep => {
          return typeof dep === 'string' ? parseInt(dep, 10) : dep;
        });
      } else {
        subtask.dependencies = [];
      }
      
      // Ensure status is 'pending'
      subtask.status = 'pending';
      
      // Add parentTaskId
      subtask.parentTaskId = parentTaskId;
      
      return subtask;
    });
    
    return subtasks;
  } catch (error) {
    log('error', `Error parsing subtasks: ${error.message}`);
    
    // Create a fallback array of empty subtasks if parsing fails
    log('warn', 'Creating fallback subtasks');
    
    const fallbackSubtasks = [];
    
    for (let i = 0; i < expectedCount; i++) {
      fallbackSubtasks.push({
        id: startId + i,
        title: `Subtask ${startId + i}`,
        description: "Auto-generated fallback subtask",
        dependencies: [],
        details: "This is a fallback subtask created because parsing failed. Please update with real details.",
        status: 'pending',
        parentTaskId: parentTaskId
      });
    }
    
    return fallbackSubtasks;
  }
}

/**
 * Generate a prompt for complexity analysis
 * @param {Object} tasksData - Tasks data object containing tasks array
 * @returns {string} Generated prompt
 */
function generateComplexityAnalysisPrompt(tasksData) {
  return `Analyze the complexity of the following tasks and provide recommendations for subtask breakdown:

${tasksData.tasks.map(task => `
Task ID: ${task.id}
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

// Export AI service functions
export {
  getPerplexityClient,
  callClaude,
  handleStreamingRequest,
  processClaudeResponse,
  generateSubtasks,
  generateSubtasksWithPerplexity,
  parseSubtasksFromText,
  generateComplexityAnalysisPrompt,
  handleClaudeError,
  getAvailableAIModel
}; 