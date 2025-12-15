/**
 * Message format conversion utilities for Minimax CLI provider
 */
import {
  LanguageModelV1FunctionToolCall,
  LanguageModelV1ImagePart,
  LanguageModelV1Message,
  LanguageModelV1TextPart,
  LanguageModelV1ToolResultPart
} from '@ai-sdk/provider-utils';
import type { MinimaxCliMessage, MinimaxCliResponse } from './types.js';

/**
 * Convert AI SDK messages to Minimax CLI compatible format
 * @param messages - Array of AI SDK messages
 * @returns Minimax CLI compatible messages
 */
export function convertToMinimaxCliMessages(
  messages: LanguageModelV1Message[]
): MinimaxCliMessage[] {
  const minimaxMessages: MinimaxCliMessage[] = [];

  for (const message of messages) {
    switch (message.role) {
      case 'system':
        // Minimax CLI may handle system messages differently
        // Adding as user message with system context
        minimaxMessages.push({
          role: 'user',
          content: `System: ${message.content
            .map(part => 
              part.type === 'text' ? part.text : 
              part.type === 'image' ? '[Image]' : ''
            )
            .join(' ')}`
        });
        break;
        
      case 'user':
        const userContent = message.content
          .map(part => {
            if (part.type === 'text') {
              return part.text;
            } else if (part.type === 'image') {
              // For image parts, we might need to handle differently based on Minimax CLI capabilities
              return '[Image]';
            } else if ((part as any).type === 'file') {
              return '[File]';
            }
            return '';
          })
          .join(' ');
        
        minimaxMessages.push({
          role: 'user',
          content: userContent
        });
        break;
        
      case 'assistant':
        const assistantContent = message.content
          .map(part => 
            part.type === 'text' ? part.text : 
            part.type === 'tool-call' ? `[Tool Call: ${part.toolName}(${JSON.stringify(part.args)})]` : 
            ''
          )
          .join(' ');
        
        minimaxMessages.push({
          role: 'assistant',
          content: assistantContent
        });
        break;
        
      case 'tool':
        // Convert tool result to user message
        minimaxMessages.push({
          role: 'user',
          content: `[Tool Result: ${message.content.map(part => 
            part.type === 'tool-result' ? 
            `${part.toolName}: ${part.result ?? ''}` : 
            ''
          ).join(' ')}]`
        });
        break;
    }
  }

  return minimaxMessages;
}

/**
 * Convert Minimax CLI response to AI SDK format
 * @param responseText - Raw response text from Minimax CLI (JSONL format)
 */
export function convertFromMinimaxCliResponse(responseText: string): {
  choices: MinimaxCliResponse[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
} {
  // Minimax CLI outputs responses in a specific format
  // This is a simplified implementation - actual format may vary
  const responses: MinimaxCliResponse[] = [];
  
  // Split by newlines for JSONL format
  const lines = responseText.split('\n').filter(line => line.trim() !== '');
  
  for (const line of lines) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(line);
      responses.push(parsed);
    } catch (e) {
      // If not JSON, treat as plain text response
      responses.push({
        role: 'assistant',
        content: line.trim()
      });
    }
  }

  // Return the last response or create from full text
  if (responses.length > 0) {
    return { choices: responses, usage: undefined };
  } else {
    return {
      choices: [{
        role: 'assistant',
        content: responseText
      }],
      usage: undefined
    };
  }
}

/**
 * Create a prompt string for Minimax CLI from messages
 * @param messages - Array of AI SDK messages
 * @returns Formatted prompt string
 */
export function createPromptFromMinimaxCliMessages(messages: MinimaxCliMessage[]): string {
  return messages
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
}

/**
 * Escape shell arguments for safe CLI execution
 * @param arg - Argument to escape
 * @returns Escaped argument
 */
export function escapeMinimaxCliArg(arg: string): string {
  // Basic shell escaping - may need to be more sophisticated depending on the system
  if (process.platform === 'win32') {
    // Windows escaping
    return `"${arg.replace(/"/g, '""')}"`;
  } else {
    // Unix-like escaping
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
  }
}