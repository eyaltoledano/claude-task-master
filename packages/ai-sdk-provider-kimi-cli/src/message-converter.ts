/**
 * Message format conversion utilities for Kimi CLI provider
 */
import {
  LanguageModelV1FunctionToolCall,
  LanguageModelV1ImagePart,
  LanguageModelV1Message,
  LanguageModelV1TextPart,
  LanguageModelV1ToolResultPart
} from '@ai-sdk/provider-utils';
import type { KimiCliMessage, KimiCliResponse } from './types.js';

/**
 * Convert AI SDK messages to Kimi CLI compatible format
 * @param messages - Array of AI SDK messages
 * @returns Kimi CLI compatible messages
 */
export function convertToKimiCliMessages(
  messages: LanguageModelV1Message[]
): KimiCliMessage[] {
  const kimiMessages: KimiCliMessage[] = [];

  for (const message of messages) {
    switch (message.role) {
      case 'system':
        // Kimi CLI may handle system messages differently
        // Adding as user message with system context
        kimiMessages.push({
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
              // For image parts, we might need to handle differently based on Kimi CLI capabilities
              return '[Image]';
            } else if ((part as any).type === 'file') {
              return '[File]';
            }
            return '';
          })
          .join(' ');
        
        kimiMessages.push({
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
        
        kimiMessages.push({
          role: 'assistant',
          content: assistantContent
        });
        break;
        
      case 'tool':
        // Convert tool result to user message
        kimiMessages.push({
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

  return kimiMessages;
}

/**
 * Convert Kimi CLI response to AI SDK format
 * @param responseText - Raw response text from Kimi CLI (JSONL format)
 */
export function convertFromKimiCliResponse(responseText: string): {
  choices: KimiCliResponse[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
} {
  // Kimi CLI outputs responses in a specific format
  // This is a simplified implementation - actual format may vary
  const responses: KimiCliResponse[] = [];
  
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
 * Create a prompt string for Kimi CLI from messages
 * @param messages - Array of AI SDK messages
 * @returns Formatted prompt string
 */
export function createPromptFromKimiCliMessages(messages: KimiCliMessage[]): string {
  return messages
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
}

/**
 * Escape shell arguments for safe CLI execution
 * @param arg - Argument to escape
 * @returns Escaped argument
 */
export function escapeKimiCliArg(arg: string): string {
  // Basic shell escaping - may need to be more sophisticated depending on the system
  if (process.platform === 'win32') {
    // Windows escaping
    return `"${arg.replace(/"/g, '""')}"`;
  } else {
    // Unix-like escaping
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
  }
}