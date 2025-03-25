
/**
 * ai-services.js
 * AI service interactions for the Task Master CLI
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { CONFIG, log, sanitizePrompt } from './utils.js';
import { startLoadingIndicator, stopLoadingIndicator } from './ui.js';

// Load environment variables
dotenv.config();

let openai;
if (process.env.OPENROUTER_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1", // OpenRouter API base URL
  });
} else {
  openai = new OpenAI({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.PERPLEXITY_API_KEY,
  });
}

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
 * Call Claude to generate tasks from a PRD
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} retryCount - Retry count
 * @returns {Object} Claude's response
 */
async function callClaude(prdContent, prdPath, numTasks, retryCount = 0) {
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

    // Use streaming request to handle large responses and show progress
    return await handleStreamingRequest(prdContent, prdPath, numTasks, CONFIG.maxTokens, systemPrompt);
  } catch (error) {
    log('error', 'Error calling Claude:', error.message);

    // Retry logic
    if (retryCount < 2) {
      log('info', `Retrying (${retryCount + 1}/2)...`);
      return await callClaude(prdContent, prdPath, numTasks, retryCount + 1);
    } else {
      throw error;
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
 * @returns {Object} Claude's response
 */
async function handleStreamingRequest(prdContent, prdPath, numTasks, maxTokens, systemPrompt) {
  const loadingIndicator = startLoadingIndicator('Generating tasks from PRD...');
  let responseText = '';

  try {
    let model = process.env.CLINE_MODEL || process.env.MODEL || CONFIG.model;
    if (process.env.AI_PROVIDER === 'CLAUDE') {
      model = process.env.MODEL || CONFIG.model; // Use MODEL for Claude
    }
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Here's the Product Requirements Document (PRD) to break down into ${numTasks} tasks:\n\n${prdContent}`,
        },
      ],
      max_tokens: maxTokens,
      temperature: CONFIG.temperature,
    });

    responseText = response.choices[0].message.content;
    stopLoadingIndicator(loadingIndicator);

    return processClaudeResponse(responseText, numTasks, 0, prdContent, prdPath);
  } catch (error) {
    stopLoadingIndicator(loadingIndicator);
    throw error;
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
 * @returns {Array} Generated subtasks
 */
async function generateSubtasks(task, numSubtasks, nextSubtaskId, additionalContext = '') {
  try {
    log('info', `Generating ${numSubtasks} subtasks for task ${task.id}: ${task.title}`);

    const loadingIndicator = startLoadingIndicator(`Generating subtasks for task ${task.id}...`);

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

    let model = process.env.CLINE_MODEL || CONFIG.model;
    if (process.env.AI_PROVIDER === 'CLAUDE') {
      model = process.env.MODEL || CONFIG.model; // Use MODEL for Claude
    }
    const message = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: CONFIG.maxTokens,
      temperature: CONFIG.temperature,
    });

    stopLoadingIndicator(loadingIndicator);

    return parseSubtasksFromText(message.choices[0].message.content, nextSubtaskId, numSubtasks, task.id);
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
 * @returns {Array} Generated subtasks
 */
async function generateSubtasksWithPerplexity(task, numSubtasks = 3, nextSubtaskId = 1, additionalContext = '') {
  try {
    // First, perform research to get context
    log('info', `Researching context for task ${task.id}: ${task.title}`);
    const perplexityClient = getPerplexityClient();

    const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || 'sonar-small-online';
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

    const systemPrompt = `You are an AI assistant helping with task breakdown for software development.
You need to break down a high-level task into ${numSubtasks} specific subtasks that can be implemented one by one.

You have been provided with research on current best practices and implementation approaches.
Use this research to inform and enhance your subtask breakdown.

Subtasks should:
1. Be specific and actionable implementation steps
2. Follow a logical sequence
3. Each handle a distinct part of the parent task
4. Include clear guidance on implementation approach, referencing the research where relevant
5. Have appropriate dependency chains between subtasks
6. Collectively cover all aspects of the parent task

For each subtask, provide:
- A clear, specific title
- Detailed implementation steps that incorporate best practices from the research
- Dependencies on previous subtasks
- Testing approach

Each subtask should be implementable in a focused coding session.`;

    const userPrompt = `Please break down this task into ${numSubtasks} specific, actionable subtasks, 
using the research findings to inform your breakdown:

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
    "description": "Detailed description",
    "dependencies": [], 
    "details": "Implementation details"
  },
  ...more subtasks...
]

Note on dependencies: Subtasks can depend on other subtasks with lower IDs. Use an empty array if there are no dependencies.`;

    const message = await openrouter.chat.completions.create({
      model: CONFIG.model,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: CONFIG.maxTokens,
      temperature: CONFIG.temperature,
    });

    stopLoadingIndicator(loadingIndicator);

    return parseSubtasksFromText(message.choices[0].message.content, nextSubtaskId, numSubtasks, task.id);
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
 * @param {Array} tasksData - Tasks data
 * @returns {string} Generated prompt
 */
function generateComplexityAnalysisPrompt(tasksData) {
  return `Analyze the complexity of the following tasks and provide recommendations for subtask breakdown:

${tasksData.map(task => `
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
  generateComplexityAnalysisPrompt
};
