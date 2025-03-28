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
import { retryManager, BACKOFF_STRATEGY } from './retry-manager.js';
import { errorHandler, ERROR_CATEGORY } from './error-handler.js';

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

// Configure common retry options for AI services
const AI_RETRY_OPTIONS = {
  maxAttempts: 3,
  delay: 2000,
  backoffStrategy: BACKOFF_STRATEGY.EXPONENTIAL_JITTER,
  retryableErrors: [
    // Function to check if error is retryable
    (error) => {
      if (error.type === 'error' && error.error) {
        // Anthropic API specific errors
        return ['overloaded_error', 'rate_limit_error', 'timeout_error'].includes(error.error.type);
      }
      
      // Network/timeout errors
      if (error.message) {
        const message = error.message.toLowerCase();
        return message.includes('timeout') || 
               message.includes('network') || 
               message.includes('socket') || 
               message.includes('econnreset') ||
               message.includes('too many requests');
      }
      
      return false;
    }
  ],
  // Callback when retry happens
  onRetry: (error, attempt, delay, context) => {
    const serviceType = context.serviceType || 'AI service';
    log('warn', `${serviceType} call failed (attempt ${attempt}). Retrying in ${Math.round(delay/1000)}s...`);
    if (CONFIG.debug) {
      log('debug', `Retry reason: ${error.message}`);
    }
  },
  context: {
    serviceType: 'Claude'
  }
};

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
 * Handle Claude API errors with user-friendly messages
 * @param {Error} error - The error from Claude API
 * @returns {string} User-friendly error message
 */
function handleClaudeError(error) {
  // Check if it's a structured error response
  if (error.type === 'error' && error.error) {
    switch (error.error.type) {
      case 'overloaded_error':
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
 * @returns {Object} Claude's response
 */
async function callClaude(prdContent, prdPath, numTasks) {
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

    // Use retry manager with circuit breaker for Claude API calls
    return await retryManager.executeWithCircuitBreaker(
      'claude-task-generation',
      async () => {
        return await handleStreamingRequest(prdContent, prdPath, numTasks, CONFIG.maxTokens, systemPrompt);
      },
      {
        maxFailures: 3,
        resetTimeout: 60000, // 1 minute
        onStateChange: (name, oldState, newState) => {
          if (newState === 'open') {
            log('warn', 'Multiple failures detected with Claude API. Pausing requests temporarily.');
          } else if (newState === 'closed' && oldState === 'open') {
            log('info', 'Claude API connection restored. Resuming normal operation.');
          }
        }
      }
    );
  } catch (error) {
    // Get user-friendly error message
    const userMessage = handleClaudeError(error);
    
    // Log the error through error handler
    const enhancedError = errorHandler.handle(error, {
      message: 'Failed to generate tasks from PRD',
      category: ERROR_CATEGORY.API,
      code: 'CLAUDE_API_ERROR',
      context: { prdPath, numTasks },
      suggestion: 'Please try again in a few minutes or check your API key configuration.'
    });
    
    throw enhancedError;
  }
}

/**
 * Handle streaming request to Claude
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} maxTokens - Maximum tokens
 * @param {string} systemPrompt - System prompt
 * @returns {Object} Claude's response
 */
async function handleStreamingRequest(prdContent, prdPath, numTasks, maxTokens, systemPrompt) {
  const loadingIndicator = startLoadingIndicator('Generating tasks from PRD...');
  let responseText = '';
  let streamingInterval = null;
  
  try {
    // Use streaming for handling large responses with retry management
    const streamingFn = async () => {
      const stream = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: maxTokens,
        temperature: CONFIG.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Here's the Product Requirements Document (PRD) to break down into ${numTasks} tasks:\n\n${prdContent}`
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
      
      return responseText;
    };
    
    // Update loading indicator to show streaming progress
    let dotCount = 0;
    const readline = await import('readline');
    streamingInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
      dotCount = (dotCount + 1) % 4;
    }, 500);
    
    // Execute with retry
    responseText = await retryManager.execute(streamingFn, {
      ...AI_RETRY_OPTIONS,
      context: {
        serviceType: 'Claude streaming',
        operation: 'task generation'
      }
    });
    
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    log('info', "Completed streaming response from Claude API!");
    
    return processClaudeResponse(responseText, numTasks, prdContent, prdPath);
  } catch (error) {
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    throw error;
  }
}

/**
 * Process Claude's response
 * @param {string} textContent - Text content from Claude
 * @param {number} numTasks - Number of tasks
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @returns {Object} Processed response
 */
function processClaudeResponse(textContent, numTasks, prdContent, prdPath) {
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
    // Handle JSON parsing errors with retry
    log('error', "Error processing Claude's response:", error.message);
    
    // Use error handler to enhance error message
    const enhancedError = errorHandler.handle(error, {
      message: "Failed to process Claude's response",
      category: ERROR_CATEGORY.APPLICATION,
      code: 'RESPONSE_PARSING_ERROR',
      context: { numTasks, prdPath },
      suggestion: 'The response format from Claude was unexpected. Try running the command again.'
    });
    
    throw enhancedError;
  }
}

/**
 * Generate subtasks for a task
 * @param {Object} task - Task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next subtask ID
 * @param {string} additionalContext - Additional context
 * @returns {Array} Generated subtasks
 */
async function generateSubtasks(task, numSubtasks, nextSubtaskId, additionalContext = '') {
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
      
      // Use streaming API call with retry management
      const streamingFn = async () => {
        const stream = await anthropic.messages.create({
          model: CONFIG.model,
          max_tokens: CONFIG.maxTokens,
          temperature: CONFIG.temperature,
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
        let streamText = '';
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.text) {
            streamText += chunk.delta.text;
          }
        }
        
        return streamText;
      };
      
      // Execute streaming with retry
      responseText = await retryManager.execute(streamingFn, {
        ...AI_RETRY_OPTIONS,
        context: {
          serviceType: 'Claude streaming',
          operation: 'subtask generation',
          taskId: task.id
        }
      });
      
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
    // Handle and enhance error
    const enhancedError = errorHandler.handle(error, {
      message: `Error generating subtasks for task ${task.id}`,
      category: ERROR_CATEGORY.API,
      code: 'SUBTASK_GENERATION_ERROR',
      context: { taskId: task.id, numSubtasks },
      suggestion: 'Try again or provide more detailed context for the task.'
    });
    
    throw enhancedError;
  }
}

/**
 * Generate subtasks with research from Perplexity
 * @param {Object} task - Task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next subtask ID
 * @param {string} additionalContext - Additional context
 * @returns {Array} Generated subtasks
 */
async function generateSubtasksWithPerplexity(task, numSubtasks = 3, nextSubtaskId = 1, additionalContext = '') {
  try {
    // First, perform research to get context
    log('info', `Researching context for task ${task.id}: ${task.title}`);
    const perplexityClient = getPerplexityClient();
    
    const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || 'sonar-pro';
    const researchLoadingIndicator = startLoadingIndicator('Researching best practices with Perplexity AI...');
    
    // Formulate research query based on task
    const researchQuery = `I need to implement "${task.title}" which involves: "${task.description}". 
What are current best practices, libraries, design patterns, and implementation approaches? 
Include concrete code examples and technical considerations where relevant.`;
    
    // Define function for making the API call with retry support
    const performResearch = async () => {
      return await perplexityClient.chat.completions.create({
        model: PERPLEXITY_MODEL,
        messages: [{
          role: 'user',
          content: researchQuery
        }],
        temperature: 0.1 // Lower temperature for more factual responses
      });
    };
    
    // Query Perplexity for research with retry handling
    const researchResponse = await retryManager.executeWithCircuitBreaker(
      'perplexity-research',
      async () => {
        return await retryManager.execute(performResearch, {
          ...AI_RETRY_OPTIONS,
          maxAttempts: 4, // Higher for research as it's critical
          context: {
            serviceType: 'Perplexity',
            operation: 'research',
            taskId: task.id
          }
        });
      },
      {
        maxFailures: 3,
        resetTimeout: 120000, // 2 minutes
        onStateChange: (name, oldState, newState) => {
          if (newState === 'open') {
            log('warn', 'Multiple failures detected with Perplexity API. Pausing research requests temporarily.');
          } else if (newState === 'closed' && oldState === 'open') {
            log('info', 'Perplexity API connection restored. Resuming normal operation.');
          }
        }
      }
    );
    
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
      
      // Define streaming function for retry purposes
      const streamingFn = async () => {
        const stream = await anthropic.messages.create({
          model: CONFIG.model,
          max_tokens: CONFIG.maxTokens,
          temperature: CONFIG.temperature,
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
        let streamText = '';
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.text) {
            streamText += chunk.delta.text;
          }
        }
        
        return streamText;
      };
      
      // Execute with retry management
      responseText = await retryManager.execute(streamingFn, {
        ...AI_RETRY_OPTIONS,
        context: {
          serviceType: 'Claude streaming',
          operation: 'research-backed subtask generation',
          taskId: task.id
        }
      });
      
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      
      return parseSubtasksFromText(responseText, nextSubtaskId, numSubtasks, task.id);
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    // Enhanced error handling
    const enhancedError = errorHandler.handle(error, {
      message: `Error generating research-backed subtasks for task ${task.id}`,
      category: ERROR_CATEGORY.API,
      code: 'PERPLEXITY_RESEARCH_ERROR',
      context: { taskId: task.id, numSubtasks },
      suggestion: 'Check your Perplexity API key or try again without research by using the standard subtask generation.'
    });
    
    log('warn', `Failed to use research for subtasks. Falling back to standard generation.`);
    
    // Fallback to standard subtask generation if research fails
    try {
      return await generateSubtasks(task, numSubtasks, nextSubtaskId, additionalContext);
    } catch (fallbackError) {
      // If even the fallback fails, throw the original error to be more informative
      throw enhancedError;
    }
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

/**
 * Call Anthropic API with system and user prompts
 * @param {string} systemPrompt - System prompt for Claude
 * @param {string} userPrompt - User prompt for Claude
 * @returns {Promise<string>} Claude's response text
 */
async function callAnthropicApi(systemPrompt, userPrompt) {
  try {
    log('info', 'Calling Anthropic API with streaming');
    
    let responseText = '';
    let streamingInterval = null;
    
    try {
      // Update loading indicator to show streaming progress
      let dotCount = 0;
      const readline = await import('readline');
      streamingInterval = setInterval(() => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
        dotCount = (dotCount + 1) % 4;
      }, 500);
      
      // Use streaming API call
      const stream = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        temperature: CONFIG.temperature,
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
      }
      
      if (streamingInterval) clearInterval(streamingInterval);
      log('info', "Completed streaming response from Claude API!");
      
      return responseText;
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      throw error;
    }
  } catch (error) {
    log('error', `Error in callAnthropicApi: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a product concept from an initial idea
 * @param {string} idea - Initial product/feature idea
 * @param {object} [options] - Additional options
 * @param {boolean} [options.showProgress=true] - Whether to show progress indicator
 * @returns {string} Structured product concept
 */
async function generateProductConcept(idea, options = {}) {
  try {
    log('info', 'Generating structured product concept from idea');
    
    // Default options
    const showProgress = options.showProgress !== false;
    
    // Import progress indicator if needed
    let progress;
    if (showProgress) {
      const { ProgressIndicator } = await import('./progress-indicator.js');
      progress = new ProgressIndicator({
        text: 'Converting idea to structured concept...',
        spinnerType: 'dots'
      });
      progress.start();
    }
    
    let responseText = '';
    
    const systemPrompt = `You are a product manager helping to convert a raw idea into a structured product concept.
Your goal is to create a comprehensive, well-organized concept document that will serve as the foundation for a Product Requirements Document (PRD).

The concept should include:
1. Executive Summary: Brief overview of the product/feature and its value proposition
2. Problem Statement: Clear definition of the problem being solved
3. Target Users: Detailed description of the primary users and their needs
4. Proposed Solution: High-level description of the solution
5. Key Features: Bulleted list of the core features with brief explanations
6. Success Metrics: How success will be measured
7. Constraints & Requirements: Technical, business, or resource constraints
8. Open Questions: Areas that need further research or decisions

Format the concept in a clean, easy-to-read structure with clear headings and concise bullet points where appropriate.`;
    
    const userPrompt = idea;
    
    try {
      const response = await callAnthropicApi(systemPrompt, userPrompt);
      responseText = response;
      
      if (progress) {
        progress.succeed('Product concept generated successfully');
      }
    } catch (error) {
      if (progress) {
        progress.fail(`Error generating concept: ${error.message}`);
      }
      throw error;
    }
    
    return responseText;
  } catch (error) {
    log('error', `Error in generateProductConcept: ${error.message}`);
    throw error;
  }
}

/**
 * Generate an expert discussion about a product concept
 * @param {string} concept - Product concept
 * @param {Array<string>} participants - List of expert participants
 * @returns {string} Simulated expert discussion
 */
async function generateExpertDiscussion(concept, participants) {
  try {
    log('info', 'Generating expert discussion on product concept');
    
    const loadingIndicator = startLoadingIndicator('Simulating expert discussion...');
    let responseText = '';
    let streamingInterval = null;
    
    // Format participants string for the prompt
    const participantsText = participants.map((participant, index) => 
      `Expert ${index + 1}: ${participant}`
    ).join('\n');
    
    const systemPrompt = `You are a facilitator for a product round-table discussion.
Your task is to simulate a detailed conversation between the following experts about a product concept:

${participantsText}

Each expert should contribute based on their specific expertise and background. The discussion should:
1. Examine strengths and weaknesses of the concept
2. Identify potential challenges and risks
3. Suggest improvements and alternative approaches
4. Consider technical feasibility and implementation concerns
5. Discuss business viability and market potential
6. Address user experience and adoption factors

Format the response as a dialogue with the name of each expert before their contribution. Ensure each expert speaks at least 3-4 times and that their perspectives build on each other's ideas. The discussion should conclude with a summary of key recommendations for improving the concept.

The output should be well-structured, detailed, and realistic as if these experts were having an actual conversation.`;

    try {
      // Update loading indicator to show streaming progress
      let dotCount = 0;
      const readline = await import('readline');
      streamingInterval = setInterval(() => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`Simulating expert discussion${'.'.repeat(dotCount)}`);
        dotCount = (dotCount + 1) % 4;
      }, 500);
      
      // Use streaming API call
      const stream = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        temperature: 0.8, // Higher temperature for diverse expert perspectives
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Here's the product concept to discuss:\n\n${concept}\n\nPlease simulate a detailed discussion between the experts, exploring various aspects of this concept and providing recommendations for improvement.`
          }
        ],
        stream: true
      });
      
      // Process the stream
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
          responseText += chunk.delta.text;
        }
      }
      
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      
      log('info', 'Successfully generated expert discussion');
      
      return responseText;
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log('error', `Error generating expert discussion: ${error.message}`);
    const userMessage = handleClaudeError(error);
    console.error(chalk.red(userMessage));
    throw new Error(userMessage);
  }
}

/**
 * Refine a product concept based on additional inputs
 * @param {string} concept - Original product concept
 * @param {string} prompt - Custom refinement prompt
 * @param {string} discussion - Expert discussion content
 * @returns {string} Refined product concept
 */
async function generateConceptRefinement(concept, prompt, discussion) {
  try {
    log('info', 'Refining product concept with additional input');
    
    const loadingIndicator = startLoadingIndicator('Refining product concept...');
    let responseText = '';
    let streamingInterval = null;
    
    // Determine what inputs we're using
    const usingPrompt = prompt && prompt.trim().length > 0;
    const usingDiscussion = discussion && discussion.trim().length > 0;
    
    // Tailor the system prompt based on available inputs
    let systemPromptText = `You are a product strategy expert helping to refine a product concept.
Your task is to improve and enhance an existing product concept`;
    
    if (usingPrompt && usingDiscussion) {
      systemPromptText += ` based on both a custom refinement prompt and insights from an expert discussion.`;
    } else if (usingPrompt) {
      systemPromptText += ` based on a custom refinement prompt.`;
    } else if (usingDiscussion) {
      systemPromptText += ` based on insights from an expert discussion.`;
    } else {
      systemPromptText += ` by identifying and addressing its weaknesses and gaps.`;
    }
    
    systemPromptText += `\n\nYour refined concept should:
1. Maintain the overall structure and purpose of the original concept
2. Address identified weaknesses or gaps
3. Incorporate suggested improvements
4. Add more detail where beneficial
5. Ensure clarity and coherence throughout

The output should be a complete, revised version of the concept that could be used directly as the basis for a PRD.
Preserve the original formatting structure (headings, bullets, etc.) while enhancing the content.`;

    // Build user message based on available inputs
    let userContent = `Here's the original product concept to refine:\n\n${concept}\n\n`;
    
    if (usingPrompt) {
      userContent += `Custom refinement prompt:\n${prompt}\n\n`;
    }
    
    if (usingDiscussion) {
      userContent += `Expert discussion insights:\n${discussion}\n\n`;
    }
    
    userContent += `Please provide a complete refined version of the concept that incorporates the appropriate improvements.`;
    
    try {
      // Update loading indicator to show streaming progress
      let dotCount = 0;
      const readline = await import('readline');
      streamingInterval = setInterval(() => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`Refining product concept${'.'.repeat(dotCount)}`);
        dotCount = (dotCount + 1) % 4;
      }, 500);
      
      // Use streaming API call
      const stream = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        temperature: 0.6, // Balanced temperature for refinement
        system: systemPromptText,
        messages: [
          {
            role: 'user',
            content: userContent
          }
        ],
        stream: true
      });
      
      // Process the stream
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
          responseText += chunk.delta.text;
        }
      }
      
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      
      log('info', 'Successfully refined product concept');
      
      return responseText;
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log('error', `Error refining concept: ${error.message}`);
    const userMessage = handleClaudeError(error);
    console.error(chalk.red(userMessage));
    throw new Error(userMessage);
  }
}

/**
 * Generate a complete PRD from a product concept
 * @param {string} concept - Refined product concept
 * @param {string} template - Optional PRD template
 * @param {boolean} useResearch - Whether to use Perplexity for research
 * @param {Object} detailedParams - Optional detailed parameters collected from user
 * @returns {string} Generated PRD
 */
async function generatePRD(concept, template, useResearch = false, detailedParams = null) {
  try {
    log('info', `Generating PRD from concept, research: ${useResearch}, detailed params: ${detailedParams ? 'yes' : 'no'}`);
    
    // Initialize variables for response
    let responseText = '';
    let researchContent = '';
    
    // Get template content if provided
    let templateContent = '';
    if (template && template.trim().length > 0) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(template)) {
          templateContent = fs.readFileSync(template, 'utf8');
          log('info', `Successfully loaded template from ${template}`);
        }
      } catch (error) {
        log('warn', `Failed to load template: ${error.message}. Proceeding without template.`);
      }
    }
    
    // Conduct research if enabled
    if (useResearch) {
      // Show message about research
      console.log(chalk.blue('Conducting market and technical research...'));
      
      try {
        // Get product name or concept summary for research
        const conceptSummary = concept.split('\n')[0].replace(/^#\s+/, '');
        
        // Use Perplexity AI for research
        const { researchTopic } = await import('./perplexity.js');
        
        // Research prompt based on concept
        const researchPrompt = `Comprehensive market and technical analysis for: ${conceptSummary}. 
Include market size, competition, technical feasibility, and implementation considerations.`;
        
        // Start loading indicator
        const loadingIndicator = startLoadingIndicator('Researching with Perplexity AI...');
        
        // Conduct research
        researchContent = await researchTopic(researchPrompt);
        
        // Stop loading indicator
        stopLoadingIndicator(loadingIndicator);
        
        log('info', 'Successfully retrieved research from Perplexity');
      } catch (error) {
        log('warn', `Error during research: ${error.message}. Proceeding with standard PRD generation.`);
        console.log(chalk.yellow(`Perplexity research failed: ${error.message}. Proceeding with standard PRD generation.`));
        useResearch = false;
      }
    }
    
    // Extract format, style, and sections from detailedParams if available
    const format = detailedParams?.format || 'markdown';
    const style = detailedParams?.style || 'standard';
    const includedSections = detailedParams?.sections || [];
    
    // Create system prompt based on available inputs
    let systemPromptText = `You are a world-class product manager creating a professional Product Requirements Document (PRD).
Your task is to transform a product concept into a comprehensive, well-structured PRD that will guide development teams.
Your PRD should be highly actionable, with clear specifications that leave no room for ambiguity.`;

    if (useResearch) {
      systemPromptText += ` You have access to market and technical research to enhance the PRD with factual information and data-driven insights.`;
    }
    
    if (templateContent) {
      systemPromptText += ` You should follow the provided PRD template structure exactly.`;
    }
    
    if (detailedParams) {
      systemPromptText += ` You have been provided with additional structured details about the product that should be incorporated into the PRD.`;
    }
    
    // Add format-specific instructions
    if (format === 'markdown') {
      systemPromptText += `\n\nGenerate the PRD in Markdown format with appropriate headings, lists, tables, and formatting.
Use # for top-level headings, ## for section headings, and ### for subsections.
Include a table of contents at the beginning with links to each section.
Use **bold text** for emphasis on important points and requirements.
Use code blocks for any technical specifications, API examples, or structured data.
Format tables with proper alignment for readability.`;
    } else if (format === 'html') {
      systemPromptText += `\n\nGenerate the PRD in clean HTML format with appropriate headings, lists, tables, and formatting.
Use proper HTML tags (<h1>, <h2>, <p>, <ul>, <table>, etc.) for structure.
Include a table of contents at the beginning with anchor links to each section.
Use semantic HTML to improve document structure (<section>, <header>, etc.).
Add appropriate CSS classes for key elements (features, requirements, metrics).
Use tables for complex information and comparisons.
The HTML should be clean, readable, and not include any complex styling or scripts.`;
    } else {
      systemPromptText += `\n\nGenerate the PRD in plain text format with clear section headings and consistent formatting.
Use consistent underlines or borders for headings and sections to improve readability.
Create visual separation between sections with line breaks and dividers.
Use indentation and special characters for lists and hierarchy.
Use ALL CAPS for section headings to make them stand out.
Maintain consistent spacing and alignment throughout the document.`;
    }
    
    // Add style-specific instructions
    if (style === 'detailed') {
      systemPromptText += `\n\nCreate a highly detailed PRD with comprehensive coverage of all aspects.
Include in-depth analysis, multiple examples, edge cases, and technical details.
For each feature, include:
- Detailed functional requirements
- Technical considerations and constraints
- User stories or use cases
- Acceptance criteria
- Dependencies and risks
- Implementation notes
- Edge cases and error states

Provide specific metrics for success criteria, with target values.
Include diagrams described in text format for key workflows and system architecture.
Add detailed timelines with milestone breakdowns.
This PRD should be thorough enough to serve as a complete reference for the development team.`;
    } else if (style === 'minimal') {
      systemPromptText += `\n\nCreate a concise, minimal PRD that focuses only on the most essential information.
Keep descriptions brief and avoid unnecessary details.
Focus on WHAT needs to be built, not HOW to build it.
Limit each feature description to 1-2 paragraphs.
Use short bullet points for requirements.
Eliminate nice-to-have features and focus only on core functionality.
The document should be easily scannable and highlight only the key points needed for implementation.
Aim for a document that could be fully read in 15 minutes.`;
    } else {
      systemPromptText += `\n\nCreate a balanced PRD with appropriate detail for most product development needs.
Include enough specificity to guide implementation without excessive detail.
For each feature, include:
- Clear description of functionality
- Core requirements
- User impact
- Success criteria
- Dependencies

Focus on clarity and actionable information.
Use concise language while still covering all essential aspects.
Strike a balance between brevity and completeness.`;
    }
    
    // Base section list with standard structure
    const allPossibleSections = [
      'executive_summary',
      'problem_statement',
      'goals',
      'personas',
      'icp',
      'features',
      'technical',
      'ux',
      'metrics',
      'timeline',
      'risks'
    ];
    
    // If sections are specified, customize the PRD structure
    if (includedSections && includedSections.length > 0) {
      const sectionsList = includedSections.map(section => {
        switch(section) {
          case 'executive_summary': return 'Executive Summary';
          case 'problem_statement': return 'Problem Statement';
          case 'goals': return 'Product Goals';
          case 'personas': return 'User Personas';
          case 'icp': return 'Ideal Customer Profile';
          case 'features': return 'Feature Specifications';
          case 'technical': return 'Technical Requirements';
          case 'ux': return 'UI/UX Considerations';
          case 'metrics': return 'Success Metrics & KPIs';
          case 'timeline': return 'Timeline & Milestones';
          case 'risks': return 'Risks & Mitigations';
          default: return section;
        }
      }).join(', ');
      
      systemPromptText += `\n\nInclude ONLY the following sections in the PRD: ${sectionsList}.`;
      
      // Check for excluded standard sections and add explicit note
      const excludedSections = allPossibleSections.filter(section => !includedSections.includes(section));
      if (excludedSections.length > 0) {
        systemPromptText += ` Do NOT include sections for: ${excludedSections.join(', ')}.`;
      }
    } else {
      systemPromptText += `\n\nYour PRD should include:
1. Executive Summary - Brief overview of the product and its core value proposition
2. Problem Statement - Clear articulation of the problem being solved and why it matters
3. Product Goals - Primary objectives and success metrics for the product
4. User Personas - Description of target users and their needs/pain points
5. Ideal Customer Profile - Detailed description of the ideal customer including industry, company size, and buying criteria
6. Feature Specifications - Detailed descriptions of all features with requirements
7. Technical Requirements - Architecture, technologies, APIs, and infrastructure needs
8. UI/UX Considerations - User experience guidelines and key user journeys
9. Success Metrics & KPIs - How success will be measured with specific targets
10. Timeline & Milestones - Development phases and key delivery dates
11. Risks & Mitigations - Potential challenges and contingency plans`;
    }
    
    // Add guidance for specific sections to improve quality
    systemPromptText += `\n\nFor feature specifications, ensure each feature includes:
- A clear description of the functionality
- The user problem it solves
- Core requirements (must-haves)
- User stories in the format "As a [user], I want to [action] so that [benefit]"
- Acceptance criteria that define when the feature is complete
- Any dependencies, constraints, or limitations

When specifying technical requirements:
- Be specific about technologies, frameworks, or APIs to use
- Define data models and key entities
- Specify performance requirements (e.g., load times, throughput)
- Address security, privacy, and compliance needs
- Describe integrations with other systems or services

For the timeline section:
- Break down the development into logical phases
- Specify key milestones with target dates
- Identify dependencies between different workstreams
- Prioritize features across the timeline (P0, P1, P2)
- Define the MVP scope clearly`;

    systemPromptText += `\n\nThe PRD should be comprehensive, well-structured, and provide clear guidance to engineering teams.
Use detailed lists, tables, and examples where appropriate to maximize clarity.
Avoid ambiguity - be specific about what should be built and how it should behave.
Make all requirements testable and measurable where possible.`;

    // Add task master specific instructions
    systemPromptText += `\n\nThis PRD should be optimized for being parsed by Task Master's parse-prd command. 
Make sure the feature descriptions are clear and detailed enough to generate quality task definitions.
Each feature and requirement should be discrete and implementable.
Use consistent formatting for tasks and requirements to aid extraction.
For optimal task parsing, use clear, action-oriented language for requirements.`;

    // Build user message based on available inputs
    let userContent = `Here's the product concept to transform into a full PRD:\n\n${concept}\n\n`;
    
    if (templateContent) {
      userContent += `Please follow this PRD template structure:\n\n${templateContent}\n\n`;
    }
    
    if (useResearch) {
      userContent += `Incorporate insights from this research to enrich the PRD with market and technical context:\n\n${researchContent}\n\n`;
    }
    
    if (detailedParams && detailedParams.sections) {
      userContent += `I've collected the following detailed parameters about the product that should be integrated into the PRD:\n\n`;
      
      // Add each section's details
      if (detailedParams.sections.overview) {
        const overview = detailedParams.sections.overview;
        userContent += `PRODUCT OVERVIEW:\n`;
        if (overview.problem) userContent += `- Problem statement: ${overview.problem}\n`;
        if (overview.goals) userContent += `- Primary goals: ${overview.goals}\n`;
        if (overview.success) userContent += `- Success metrics: ${overview.success}\n\n`;
      }
      
      if (detailedParams.sections.features) {
        const featuresData = detailedParams.sections.features;
        userContent += `CORE FEATURES:\n`;
        
        if (featuresData.features && featuresData.features.length > 0) {
          featuresData.features.forEach((feature, index) => {
            userContent += `Feature ${index + 1}: ${feature.name}\n`;
            if (feature.description) userContent += `- Description: ${feature.description}\n`;
            if (feature.importance) userContent += `- Importance: ${feature.importance}\n`;
            userContent += `\n`;
          });
        }
      }
      
      if (detailedParams.sections.users) {
        const users = detailedParams.sections.users;
        userContent += `USER EXPERIENCE:\n`;
        if (users.targetUsers) userContent += `- Target users: ${users.targetUsers}\n`;
        if (users.primaryPersona) userContent += `- Primary persona: ${users.primaryPersona}\n`;
        if (users.userJourney) userContent += `- Key user journey: ${users.userJourney}\n\n`;
      }
      
      if (detailedParams.sections.icp) {
        const icp = detailedParams.sections.icp;
        userContent += `IDEAL CUSTOMER PROFILE:\n`;
        if (icp.industry) userContent += `- Industry: ${icp.industry}\n`;
        if (icp.companySize) userContent += `- Company size: ${icp.companySize}\n`;
        if (icp.decisionMakers) userContent += `- Decision makers: ${icp.decisionMakers}\n`;
        if (icp.painPoints) userContent += `- Pain points: ${icp.painPoints}\n`;
        if (icp.buyingCriteria) userContent += `- Buying criteria: ${icp.buyingCriteria}\n\n`;
      }
      
      if (detailedParams.sections.technical) {
        const technical = detailedParams.sections.technical;
        userContent += `TECHNICAL ARCHITECTURE:\n`;
        if (technical.stack) userContent += `- Technology stack: ${technical.stack}\n`;
        if (technical.apis) userContent += `- External APIs: ${technical.apis}\n`;
        if (technical.dataModel) userContent += `- Data model: ${technical.dataModel}\n\n`;
      }
      
      if (detailedParams.sections.roadmap) {
        const roadmap = detailedParams.sections.roadmap;
        userContent += `DEVELOPMENT ROADMAP:\n`;
        if (roadmap.mvpFeatures) userContent += `- MVP features: ${roadmap.mvpFeatures}\n`;
        if (roadmap.phases) userContent += `- Development phases: ${roadmap.phases}\n`;
        if (roadmap.dependencies) userContent += `- Critical dependencies: ${roadmap.dependencies}\n\n`;
      }
      
      if (detailedParams.sections.risks) {
        const risksData = detailedParams.sections.risks;
        userContent += `RISKS AND MITIGATIONS:\n`;
        
        if (risksData.risks && risksData.risks.length > 0) {
          risksData.risks.forEach((risk, index) => {
            userContent += `Risk ${index + 1}: ${risk.description}\n`;
            if (risk.severity) userContent += `- Severity: ${risk.severity}\n`;
            if (risk.mitigation) userContent += `- Mitigation: ${risk.mitigation}\n`;
            userContent += `\n`;
          });
        }
      }
    }
    
    // Add output format instructions to user message
    userContent += `\nPlease generate the PRD in ${format === 'markdown' ? 'Markdown' : format === 'html' ? 'HTML' : 'plain text'} format `;
    userContent += `with a ${style} level of detail, focusing on the sections we discussed.`;
    userContent += `\nEnsure the PRD is actionable, specific, and leaves no room for ambiguity about what needs to be built.`;
    
    // Call Claude to generate PRD
    const loadingIndicator = startLoadingIndicator('Generating PRD with Claude...');
    
    try {
      // Make API call
      const response = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: parseInt(CONFIG.maxTokens, 10),
        temperature: parseFloat(CONFIG.temperature),
        system: systemPromptText,
        messages: [
          {
            role: 'user',
            content: userContent
          }
        ]
      });
      
      responseText = response.content[0].text;
      stopLoadingIndicator(loadingIndicator);
      
      log('info', 'Successfully generated PRD');
      return responseText;
    } catch (error) {
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log('error', `Error generating PRD: ${error.message}`);
    const userMessage = handleClaudeError(error);
    console.error(chalk.red(userMessage));
    throw new Error(userMessage);
  }
}

/**
 * Extract summary and key insights from an expert discussion
 * @param {string} discussionContent - Text content of the expert discussion
 * @returns {Promise<Object>} Object containing summary and key insights
 */
async function extractDiscussionSummary(discussionContent) {
  try {
    log('info', 'Extracting key insights and summary from discussion');
    
    const loadingIndicator = startLoadingIndicator('Extracting key insights from discussion...');
    let responseText = '';
    let streamingInterval = null;
    
    const systemPrompt = `You are an expert AI assistant helping to extract the most valuable information from an expert round-table discussion about a product concept.

Your task is to analyze the discussion and extract:
1. A concise executive summary (2-3 paragraphs maximum)
2. The key insights and recommendations (5-8 bullet points)
3. The main challenges or concerns identified (3-5 bullet points)
4. Action items or next steps suggested (if any)

Format the output as a structured JSON object with these fields:
- summary: A concise executive summary
- keyInsights: Array of key insights and recommendations
- challenges: Array of main challenges or concerns
- actionItems: Array of suggested action items or next steps

Your analysis should be objective and focus on extracting the most actionable and valuable information from the discussion.`;

    try {
      // Update loading indicator to show streaming progress
      let dotCount = 0;
      const readline = await import('readline');
      streamingInterval = setInterval(() => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`Extracting insights from discussion${'.'.repeat(dotCount)}`);
        dotCount = (dotCount + 1) % 4;
      }, 500);
      
      // Use streaming API call
      const stream = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        temperature: 0.3, // Lower temperature for more factual extraction
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Here's the expert discussion to analyze and extract key information from:\n\n${discussionContent}\n\nPlease extract the most valuable insights and format as a JSON object.`
          }
        ],
        stream: true
      });
      
      // Process the stream
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
          responseText += chunk.delta.text;
        }
      }
      
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      
      log('info', 'Successfully extracted insights from discussion');
      
      // Parse the JSON response
      const jsonResponse = parseJsonFromText(responseText);
      
      // Return the structured insights
      return jsonResponse;
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log('error', `Error extracting discussion summary: ${error.message}`);
    const userMessage = handleClaudeError(error);
    console.error(chalk.red(userMessage));
    throw new Error(userMessage);
  }
}

/**
 * Helper function to parse JSON from Claude's response text
 * @param {string} text - Response text from Claude
 * @returns {Object} Parsed JSON object
 */
function parseJsonFromText(text) {
  try {
    // Find JSON-like content in the text using regex
    const jsonMatches = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatches && jsonMatches[0]) {
      // Parse the first match as JSON
      return JSON.parse(jsonMatches[0]);
    }
    
    // If no JSON-like structure is found, try to be more lenient
    const startPos = text.indexOf('{');
    const endPos = text.lastIndexOf('}');
    
    if (startPos !== -1 && endPos !== -1 && endPos > startPos) {
      // Extract potential JSON content
      const jsonContent = text.substring(startPos, endPos + 1);
      return JSON.parse(jsonContent);
    }
    
    throw new Error('Could not find valid JSON in the response');
  } catch (error) {
    log('error', `Error parsing JSON from text: ${error.message}`);
    
    // Create a default structure if parsing fails
    return {
      summary: "Failed to extract a proper summary from the discussion.",
      keyInsights: ["Failed to extract key insights - please review the full discussion"],
      challenges: ["Failed to extract challenges - please review the full discussion"],
      actionItems: ["Review the full discussion for action items"]
    };
  }
}

/**
 * Generate a preview of a PRD from a product concept
 * @param {string} concept - Refined product concept
 * @param {string} template - Optional PRD template
 * @param {boolean} useResearch - Whether to use Perplexity for research
 * @param {Object} detailedParams - Optional detailed parameters collected from user
 * @returns {Promise<string>} Generated PRD preview with section outlines
 */
async function generatePRDPreview(concept, template, useResearch = false, detailedParams = null) {
  try {
    log('info', 'Generating PRD preview from concept');
    
    // Get template content if provided
    let templateContent = '';
    if (template && template.trim().length > 0) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(template)) {
          templateContent = fs.readFileSync(template, 'utf8');
          log('info', `Successfully loaded template for preview from ${template}`);
        }
      } catch (error) {
        log('warn', `Failed to load template for preview: ${error.message}. Proceeding without template.`);
      }
    }
    
    // Extract format, style, and sections from detailedParams if available
    const format = detailedParams?.format || 'markdown';
    const style = detailedParams?.style || 'standard';
    const includedSections = detailedParams?.sections || [];
    
    // Create system prompt for preview generation
    let systemPromptText = `You are a senior product manager creating a preview of a Product Requirements Document (PRD).
Your task is to create a brief outline/preview of what the full PRD will include based on the product concept.
The preview should include section headers and brief 1-2 sentence summaries of what each section will contain.`;

    if (templateContent) {
      systemPromptText += ` You should follow the provided PRD template structure.`;
    }
    
    if (detailedParams) {
      systemPromptText += ` Incorporate the structured details provided about the product in your outline.`;
    }
    
    // Add style-specific instructions for preview
    if (style === 'detailed') {
      systemPromptText += ` The preview should indicate that the full PRD will be highly detailed and comprehensive.`;
    } else if (style === 'minimal') {
      systemPromptText += ` The preview should indicate that the full PRD will be concise and minimal.`;
    }
    
    // If sections are specified, customize the preview structure
    if (includedSections && includedSections.length > 0) {
      const sectionsList = includedSections.map(section => {
        switch(section) {
          case 'executive_summary': return 'Executive Summary';
          case 'problem_statement': return 'Problem Statement';
          case 'goals': return 'Product Goals';
          case 'personas': return 'User Personas';
          case 'icp': return 'Ideal Customer Profile';
          case 'features': return 'Feature Specifications';
          case 'technical': return 'Technical Requirements';
          case 'ux': return 'UI/UX Considerations';
          case 'metrics': return 'Success Metrics & KPIs';
          case 'timeline': return 'Timeline & Milestones';
          case 'risks': return 'Risks & Mitigations';
          default: return section;
        }
      }).join(', ');
      
      systemPromptText += `\n\nInclude ONLY the following sections in the preview: ${sectionsList}.`;
    } else {
      systemPromptText += `\n\nThe preview should show an outline of:
1. Introduction and background
2. Problem statement and goals
3. User personas
4. Ideal customer profile
5. Feature specifications (brief bullet points)
6. Technical approach
7. High-level timeline
8. Success metrics`;
    }
    
    systemPromptText += `\n\nThe preview should be concise and give the user a clear idea of what the full PRD will include.
Keep it under 500 words and focus on clarity and structure. This will help users decide if they want to proceed with generating the full PRD.`;

    // Build user message based on available inputs
    let userContent = `Please generate a preview outline of a PRD based on this product concept:\n\n${concept}\n\n`;
    
    if (templateContent) {
      userContent += `Follow this template structure:\n\n${templateContent}\n\n`;
    }
    
    if (detailedParams && detailedParams.sections) {
      userContent += `Incorporate these product details in your preview:\n\n`;
      
      // Add overview section if available
      if (detailedParams.sections.overview) {
        const overview = detailedParams.sections.overview;
        userContent += `PRODUCT OVERVIEW:\n`;
        if (overview.problem) userContent += `- Problem: ${overview.problem}\n`;
        if (overview.goals) userContent += `- Goals: ${overview.goals}\n`;
      }
      
      // Add core features if available
      if (detailedParams.sections.features && 
          detailedParams.sections.features.features && 
          detailedParams.sections.features.features.length > 0) {
        userContent += `\nCORE FEATURES:\n`;
        detailedParams.sections.features.features.forEach((feature, index) => {
          userContent += `- ${feature.name}\n`;
        });
      }
      
      // Add ICP details if available
      if (detailedParams.sections.icp) {
        const icp = detailedParams.sections.icp;
        userContent += `\nIDEAL CUSTOMER PROFILE:\n`;
        if (icp.industry) userContent += `- Industry: ${icp.industry}\n`;
        if (icp.companySize) userContent += `- Company size: ${icp.companySize}\n`;
        if (icp.decisionMakers) userContent += `- Decision makers: ${icp.decisionMakers}\n`;
        if (icp.painPoints) userContent += `- Pain points: ${icp.painPoints}\n`;
        if (icp.buyingCriteria) userContent += `- Buying criteria: ${icp.buyingCriteria}\n\n`;
      }
    }
    
    userContent += `\nPlease create a concise preview (under 500 words) with section headings and brief summaries that gives me a good idea of what the full PRD would include.`;
    userContent += `\nThe full PRD will be in ${format === 'markdown' ? 'Markdown' : format === 'html' ? 'HTML' : 'plain text'} format with a ${style} level of detail.`;
    
    // Call Claude to generate preview
    const loadingIndicator = startLoadingIndicator('Generating PRD preview...');
    let responseText = '';
    
    try {
      // Make API call
      const response = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: 1000, // Shorter response for preview
        temperature: 0.5,
        system: systemPromptText,
        messages: [
          {
            role: 'user',
            content: userContent
          }
        ]
      });
      
      responseText = response.content[0].text;
      stopLoadingIndicator(loadingIndicator);
      
      log('info', 'Successfully generated PRD preview');
      return responseText;
    } catch (error) {
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    log('error', `Error generating PRD preview: ${error.message}`);
    const userMessage = handleClaudeError(error);
    console.error(chalk.red(userMessage));
    throw new Error(userMessage);
  }
}

/**
 * Check the status of AI service circuit breakers and reset if needed
 * @param {boolean} resetAll - Whether to reset all circuits regardless of state
 * @returns {Object} Status of all AI service circuits
 */
export function checkAICircuitStatus(resetAll = false) {
  const circuits = {
    claude: retryManager.getCircuitState('claude-task-generation'),
    perplexity: retryManager.getCircuitState('perplexity-research')
  };
  
  if (resetAll) {
    log('info', 'Resetting all AI service circuits...');
    retryManager.resetAllCircuits();
    return {
      status: 'reset',
      message: 'All AI service circuits have been reset',
      previousState: circuits
    };
  }
  
  // Check if any circuits are open and provide status
  const openCircuits = [];
  
  Object.entries(circuits).forEach(([name, circuit]) => {
    if (circuit && circuit.state === 'open') {
      openCircuits.push(name);
    }
  });
  
  if (openCircuits.length > 0) {
    const circuitList = openCircuits.join(', ');
    log('warn', `The following AI service circuits are open: ${circuitList}`);
    
    return {
      status: 'degraded',
      message: `Some AI services (${circuitList}) are temporarily unavailable due to repeated failures`,
      openCircuits: openCircuits,
      allCircuits: circuits
    };
  }
  
  return {
    status: 'healthy',
    message: 'All AI services are available',
    allCircuits: circuits
  };
}

/**
 * Reset a specific AI service circuit
 * @param {string} serviceName - Service name ('claude', 'perplexity', or 'all')
 * @returns {Object} Status of the reset operation
 */
export function resetAICircuit(serviceName) {
  const circuitMap = {
    claude: 'claude-task-generation',
    perplexity: 'perplexity-research'
  };
  
  if (serviceName === 'all') {
    retryManager.resetAllCircuits();
    log('info', 'All AI service circuits have been reset');
    return {
      status: 'success',
      message: 'All AI service circuits have been reset'
    };
  }
  
  const circuitName = circuitMap[serviceName];
  if (!circuitName) {
    return {
      status: 'error',
      message: `Unknown service: ${serviceName}. Available services are: claude, perplexity, all`
    };
  }
  
  const previousState = retryManager.getCircuitState(circuitName);
  retryManager.resetCircuit(circuitName);
  
  log('info', `Reset circuit for ${serviceName} service`);
  return {
    status: 'success',
    message: `${serviceName} service circuit has been reset`,
    previousState: previousState
  };
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
  // New export for PRD generation
  generateProductConcept,
  generateExpertDiscussion,
  generateConceptRefinement,
  generatePRD,
  // New export for discussion summary extraction
  extractDiscussionSummary,
  generatePRDPreview,
  callAnthropicApi
}; 