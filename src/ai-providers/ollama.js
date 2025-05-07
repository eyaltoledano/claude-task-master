// ollamaClient.ts
import axios from 'axios';
import { log } from '../../scripts/modules/utils.js';

const DEFAULT_BASE_URL = 'http://localhost:11434/api';
const DEFAULT_MODEL = 'MHKetbi/Qwen2.5-Coder-32B-Instruct';

function getClient(baseURL = DEFAULT_BASE_URL) {
  return baseURL;
}

/**
 * Generates text using an Ollama model (non-streaming).
 * @param {object} params - Parameters for text generation.
 * @param {string} [params.baseURL] - Ollama API base URL.
 * @param {string} params.modelId - Model ID to use.
 * @param {string} params.prompt - Prompt string.
 * @param {number} [params.temperature] - Sampling temperature.
 * @param {number} [params.maxTokens] - Max tokens to generate.
 * @returns {Promise<string>} The generated text.
 */
export async function generateOllamaText({
  baseURL,
  modelId = DEFAULT_MODEL,
  prompt,
  temperature,
  maxTokens,
  ...rest
}) {
  log('debug', `Generating Ollama text with model: ${modelId}`);
  try {
    const url = getClient(baseURL) + '/generate';
    // Combine messages into a single prompt if present
    let finalPrompt = prompt;
    if (rest.messages && Array.isArray(rest.messages)) {
      finalPrompt = rest.messages.map(m => m.content).join('\n');
      delete rest.messages;
    }
    const payload = {
      model: modelId,
      prompt: finalPrompt,
      stream: false,
      temperature,
      num_predict: maxTokens
    };
    // Remove undefined values
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k]
    );
    const response = await axios.post(url, payload);
    if (response.data && response.data.response) {
      return response.data.response.trim();
    }
    throw new Error('No response from Ollama model');
  } catch (error) {
    log('error', `Ollama generateText failed: ${error.message}`);
    throw error;
  }
}

/**
 * Streams text using an Ollama model.
 * @param {object} params - Parameters for streaming.
 * @param {string} [params.baseURL] - Ollama API base URL.
 * @param {string} params.modelId - Model ID to use.
 * @param {string} params.prompt - Prompt string.
 * @param {number} [params.temperature] - Sampling temperature.
 * @param {number} [params.maxTokens] - Max tokens to generate.
 * @returns {AsyncGenerator<string>} Async generator yielding text chunks.
 */
export async function* streamOllamaText({
  baseURL,
  modelId = DEFAULT_MODEL,
  prompt,
  temperature,
  maxTokens,
  ...rest
}) {
  log('debug', `Streaming Ollama text with model: ${modelId}`);
  try {
    const url = getClient(baseURL) + '/generate';
    const payload = {
      model: modelId,
      prompt,
      stream: true,
      temperature,
      num_predict: maxTokens,
      ...rest
    };
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k]
    );
    const response = await axios({
      method: 'post',
      url,
      data: payload,
      responseType: 'stream',
    });
    let buffer = '';
    for await (const chunk of response.data) {
      buffer += chunk.toString();
      // Ollama streams JSON objects per line
      let lines = buffer.split('\n');
      buffer = lines.pop(); // last may be incomplete
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.response) {
            yield data.response;
          }
          if (data.done) return;
        } catch (e) {
          log('warn', 'Failed to parse Ollama stream chunk:', line);
        }
      }
    }
  } catch (error) {
    log('error', `Ollama streamText failed: ${error.message}`);
    throw error;
  }
}

/**
 * Generates a structured object using an Ollama model (JSON/object output).
 * @param {object} params - Parameters for object generation.
 * @param {string} [params.baseURL] - Ollama API base URL.
 * @param {string} params.modelId - Model ID to use.
 * @param {string} params.prompt - Prompt string.
 * @param {number} [params.temperature] - Sampling temperature.
 * @param {number} [params.maxTokens] - Max tokens to generate.
 * @returns {Promise<object>} The generated object.
 */
export async function generateOllamaObject({
  baseURL,
  modelId = DEFAULT_MODEL,
  prompt,
  temperature,
  maxTokens,
  ...rest
}) {
  try {
    const url = getClient(baseURL) + '/generate';
    // Combine messages into a single prompt if present
    let finalPrompt = prompt;
    if (rest.messages && Array.isArray(rest.messages)) {
      finalPrompt = rest.messages.map(m => m.content).join('\n');
      delete rest.messages;
    }
    const payload = {
      model: modelId,
      prompt: finalPrompt,
      stream: false,
      temperature,
      num_predict: maxTokens
    };
    // Remove undefined values
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k]
    );
    const response = await axios.post(url, payload);
    if (response.data && response.data.response) {
      const match = response.data.response.match(/```json\n([\s\S]*?)```/i) ||
                    response.data.response.match(/```([\s\S]*?)```/i);
      let jsonString;
      if (match) {
        jsonString = match[1];
      } else {
        const curly = response.data.response.match(/{[\s\S]*}/);
        if (curly) jsonString = curly[0];
      }
      if (jsonString) {
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          log('error', 'Ollama object output is not valid JSON:', jsonString);
          throw new Error('Ollama object output is not valid JSON');
        }
      }
      log('error', 'Ollama response did not contain a JSON object:', response.data.response);
      throw new Error('Ollama response did not contain a JSON object');
    }
    throw new Error('No response from Ollama model');
  } catch (error) {
    log('error', `Ollama generateObject failed: ${error.message}`);
    throw error;
  }
}
