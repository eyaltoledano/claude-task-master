/**
 * AI Services Module
 * Handles communication with AI APIs (Anthropic, Perplexity, etc.)
 */

import Anthropic from '@anthropic-ai/sdk';
import { retryWithExponentialBackoff } from './utils.js';
import { CONFIG } from '../config.js';
import chalk from 'chalk';
import { log } from './utils.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Environment variables and configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || CONFIG.model || 'claude-3-7-sonnet';
const MAX_TOKENS = process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS) : 4000;
const TEMPERATURE = process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : 0.7;

// Perplexity API options
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || 'sonar-pro';
const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/chat/completions';

// Create Anthropic client
let anthropic;
try {
  if (ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
  } else if (process.env.NODE_ENV !== 'test') {
    log('warn', 'ANTHROPIC_API_KEY environment variable is not set. AI features will be limited.');
  }
} catch (error) {
  log('error', `Failed to initialize Anthropic client: ${error.message}`);
}

/**
 * Call the LLM API with retry logic for reliability
 * @param {Object} options - Request options
 * @param {Array} options.messages - Message array to send to the LLM
 * @param {string} [options.system] - System prompt
 * @param {string} [options.model] - Model to use (defaults to CONFIG.model)
 * @param {number} [options.max_tokens] - Maximum tokens in the response
 * @param {number} [options.temperature] - Temperature for response generation
 * @param {number} [options.retries=3] - Number of retries on failure
 * @param {Function} [options.onRetry] - Function to call when a retry occurs
 * @param {boolean} [options.fastFail=true] - Whether to fail immediately on permanent errors
 * @returns {Promise<Object>} - LLM response
 */
export async function callLLMWithRetry(options) {
  const { 
    messages,
    system,
    model = MODEL, 
    max_tokens = MAX_TOKENS, 
    temperature = TEMPERATURE,
    retries = 3,
    onRetry = null,
    fastFail = true
  } = options;

  if (!anthropic && process.env.NODE_ENV !== 'test') {
    throw new Error('Anthropic client is not initialized. Please check your API key.');
  }

  // For testing environments
  if (process.env.NODE_ENV === 'test') {
    return { content: "Test response from mock LLM API" };
  }

  const callLLM = async () => {
    try {
      log('debug', `Calling Claude API with model: ${model}, max_tokens: ${max_tokens}, temperature: ${temperature}`);
      
      // Extract system message if present in old format
      let cleanedMessages = messages;
      let systemPrompt = system;

      // Handle backward compatibility with messages that might contain system role
      if (!systemPrompt && Array.isArray(messages)) {
        const systemMessageIndex = messages.findIndex(msg => msg.role === 'system');
        
        if (systemMessageIndex !== -1) {
          // Extract the system message and remove it from the messages array
          systemPrompt = messages[systemMessageIndex].content;
          cleanedMessages = messages.filter(msg => msg.role !== 'system');
          log('debug', 'Extracted system message from messages array for compatibility');
        }
      }
      
      const response = await anthropic.messages.create({
        model,
        max_tokens,
        temperature,
        system: systemPrompt,
        messages: cleanedMessages,
      });

      // Ensure we're using the correct response structure
      // Claude API returns content in response.content
      return {
        content: response.content?.[0]?.text || response.content || "No content returned"
      };
    } catch (error) {
      log('error', `Claude API error: ${error.message}`);
      throw error;
    }
  };

  return retryWithExponentialBackoff(
    callLLM, 
    retries, 
    1000,  // initialDelay 
    10000, // maxDelay
    {
      useRateLimit: true,
      fastFail,
      onRetry
    }
  );
}

/**
 * Call the Perplexity API for research-backed results
 * @param {Object} options - Request options
 * @param {string} options.query - Research query
 * @param {string} [options.system] - System prompt
 * @param {string} [options.model] - Model to use (defaults to PERPLEXITY_MODEL)
 * @param {number} [options.max_tokens] - Maximum tokens in the response
 * @param {number} [options.temperature] - Temperature for response generation
 * @param {number} [options.retries=3] - Number of retries on failure
 * @returns {Promise<Object>} - Research response
 */
export async function callPerplexityWithRetry(options) {
  const { 
    query,
    system = 'You are a helpful research assistant with access to the latest information.',
    model = PERPLEXITY_MODEL, 
    max_tokens = MAX_TOKENS, 
    temperature = 0.5,
    retries = 3
  } = options;

  if (!PERPLEXITY_API_KEY && process.env.NODE_ENV !== 'test') {
    log('warn', 'PERPLEXITY_API_KEY environment variable is not set. Using Anthropic without research capabilities.');
    
    // Fall back to Anthropic with a system message indicating we want research
    return callLLMWithRetry({
      system: `You are a helpful research assistant. You'll provide factual, up-to-date information on the topic requested.
                Use your training data to give the most accurate information, and be clear about any limitations in your knowledge.
                Organize your response in a structured format with clear sections for different aspects of the topic.`,
      messages: [
        { role: 'user', content: query }
      ],
      model: MODEL,
      max_tokens,
      temperature: 0.3, // Lower temperature for more factual responses
      retries
    });
  }

  // For testing environments
  if (process.env.NODE_ENV === 'test') {
    return { 
      choices: [{ message: { content: "Test response from mock Perplexity API" } }]
    };
  }

  const callPerplexity = async () => {
    try {
      log('debug', `Calling Perplexity API with query: ${query.substring(0, 50)}...`);
      
      const response = await fetch(PERPLEXITY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: query }
          ],
          max_tokens,
          temperature
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Perplexity API error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      log('error', `Perplexity API error: ${error.message}`);
      throw error;
    }
  };

  try {
    const result = await retryWithExponentialBackoff(callPerplexity, retries);
    // Normalize the response format to match Anthropic's
    return { content: result.choices[0].message.content };
  } catch (error) {
    log('warn', `Failed to get research data from Perplexity. Falling back to Anthropic: ${error.message}`);
    
    // Fall back to Anthropic
    return callLLMWithRetry({
      system: 'You are a helpful research assistant. Provide information on the topic requested.',
      messages: [
        { role: 'user', content: query }
      ],
      model: MODEL,
      max_tokens,
      temperature: 0.3,
      retries
    });
  }
}

/**
 * Check if API keys are properly configured
 * @returns {Object} Configuration status for different AI services
 */
export function checkAIConfiguration() {
  return {
    anthropic: {
      configured: !!ANTHROPIC_API_KEY,
      model: MODEL
    },
    perplexity: {
      configured: !!PERPLEXITY_API_KEY,
      model: PERPLEXITY_MODEL
    }
  };
}

export default {
  callLLMWithRetry,
  callPerplexityWithRetry,
  checkAIConfiguration
};
