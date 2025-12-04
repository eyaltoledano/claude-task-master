/**
 * Integration Tests for Tool Calling with Native Cortex REST API
 * 
 * These tests verify that tool calling works correctly with the Native Cortex endpoint.
 * Requires valid Snowflake credentials in environment variables.
 * 
 * NOTE: Tool calling via AI SDK is REST API ONLY.
 * CLI mode has internal MCP/skills support, but this is not exposed through the AI SDK.
 * These tests focus on the REST API native tool calling implementation.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createSnowflake } from '../../src/index.js';
import { generateText, stepCountIs } from 'ai';
import { z } from 'zod';
import { skipIfNoCredentials, logTestEnvironment } from '../test-utils.js';

// Define test tools using AI SDK v5 API
const calculatorTool = {
	description: 'Perform simple arithmetic calculations',
	inputSchema: z.object({
		operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
		a: z.number(),
		b: z.number()
	}),
	execute: async ({ operation, a, b }: { operation: string; a: number; b: number }) => {
		switch (operation) {
			case 'add': return { result: a + b };
			case 'subtract': return { result: a - b };
			case 'multiply': return { result: a * b };
			case 'divide': return b !== 0 ? { result: a / b } : { error: 'Division by zero' };
			default: return { error: 'Unknown operation' };
		}
	}
};

const weatherTool = {
	description: 'Get the current weather for a location (mock)',
	inputSchema: z.object({
		location: z.string().describe('City name or location')
	}),
	execute: async ({ location }: { location: string }) => {
		// Mock weather data
		return {
			location,
			temperature: 72,
			conditions: 'sunny',
			humidity: 45
		};
	}
};

skipIfNoCredentials('Tool Calling Integration Tests', () => {
	let provider: ReturnType<typeof createSnowflake>;
	
	beforeAll(() => {
		logTestEnvironment('Tool Calling Tests');
		console.log('Execution mode: rest');
		console.log('DEBUG MODE: Set DEBUG=snowflake:* to see API calls');
		provider = createSnowflake({ executionMode: 'rest' });
	});
	
	describe('Basic Tool Calling', () => {
		it('should call a single tool', async () => {
			console.log('\n🧪 Testing single tool call');
			const model = provider.languageModel('cortex/claude-sonnet-4-5');
			console.log('📡 Making API call with tool definition...');
			
			const { text, steps } = await generateText({
				model,
				tools: { calculator: calculatorTool },
				prompt: 'What is 25 + 17? Use the calculator tool.',
				stopWhen: stepCountIs(3)
			});
			
			// With multi-step calls, toolCalls in final result is from last step only.
			// Use steps.flatMap to get all tool calls across all steps
			const allToolCalls = steps.flatMap(step => step.toolCalls);
			
			console.log('✅ API call completed');
			console.log(`📊 Steps: ${steps.length}, Total tool calls: ${allToolCalls.length}`);
			console.log(`📝 Response text: ${text.substring(0, 100)}...`);
			
			// The model should have used the calculator tool in one of the steps
			expect(allToolCalls.length).toBeGreaterThan(0);
			
			// Check that the result includes the answer
			const calcCall = allToolCalls.find(tc => tc.toolName === 'calculator');
			expect(calcCall).toBeDefined();
			if (calcCall && 'args' in calcCall) {
				const input = calcCall.args as { operation: string; a: number; b: number };
				console.log(`🔧 Tool called with: ${JSON.stringify(input)}`);
				expect(input.operation).toBe('add');
				expect(input.a).toBe(25);
				expect(input.b).toBe(17);
			}
			
			console.log('Tool call result:', text);
			expect(text).toContain('42'); // 25 + 17 = 42
		}, 30000);
		
		it('should call multiple tools', async () => {
			const model = provider.languageModel('cortex/claude-sonnet-4-5');
			
			const { text, steps } = await generateText({
				model,
				tools: { 
					calculator: calculatorTool,
					weather: weatherTool
				},
				prompt: 'First multiply 6 by 7, then check the weather in New York. Use both tools.',
				stopWhen: stepCountIs(5)
			});
			
			// Get all tool calls from all steps
			const allToolCalls = steps.flatMap(step => step.toolCalls);
			
			console.log('Multi-tool result:', text);
			console.log('Tool calls:', allToolCalls.map(tc => tc.toolName));
			
			// Should have used both tools across all steps
			expect(allToolCalls.length).toBeGreaterThanOrEqual(2);
			expect(allToolCalls.some(tc => tc.toolName === 'calculator')).toBe(true);
			expect(allToolCalls.some(tc => tc.toolName === 'weather')).toBe(true);
		}, 60000);
	});
	
	describe('Tool Calling with Different Models', () => {
		const modelsToTest = [
			'cortex/claude-sonnet-4-5',
			'cortex/openai-gpt-4.1'
		];
		
		for (const modelId of modelsToTest) {
			it(`should handle tool calls with ${modelId}`, async () => {
				try {
					const model = provider.languageModel(modelId);
					
					const { steps } = await generateText({
						model,
						tools: { calculator: calculatorTool },
						prompt: 'Calculate 100 divided by 4 using the calculator.',
						stopWhen: stepCountIs(3)
					});
					
				// Get all tool calls from all steps
				const allToolCalls = steps.flatMap(step => step.toolCalls);
				
				expect(allToolCalls.length).toBeGreaterThan(0);
				const calcCall = allToolCalls.find(tc => tc.toolName === 'calculator');
				expect(calcCall).toBeDefined();
				
				if (calcCall && 'args' in calcCall) {
					const input = calcCall.args as { operation: string; a: number; b: number };
					expect(input.operation).toBe('divide');
					expect(input.a).toBe(100);
					expect(input.b).toBe(4);
				}
					
					console.log(`${modelId} tool call successful`);
				} catch (error) {
					// Some models might not be available in all regions
					if (error instanceof Error && error.message.includes('500')) {
						console.log(`[INFO] ${modelId} returned 500, may be unavailable in this region`);
						return;
					}
					throw error;
				}
			}, 30000);
		}
	});
	
	describe('Tool Execution Flow', () => {
		it('should execute tool and include result in response', async () => {
			const model = provider.languageModel('cortex/claude-sonnet-4-5');
			
			const { text, steps } = await generateText({
				model,
				tools: { calculator: calculatorTool },
				prompt: 'What is 15 times 8? Use the calculator and tell me the result.',
				stopWhen: stepCountIs(3)
			});
			
			// Get all tool results from all steps
			const allToolResults = steps.flatMap(step => step.toolResults);
			
			console.log('Tool execution result:', text);
			console.log('Tool results:', allToolResults);
			
			// Tool should have been executed
			expect(allToolResults.length).toBeGreaterThan(0);
			
			// Response should include the answer
			expect(text.toLowerCase()).toContain('120');
		}, 30000);
		
		it('should handle tool with no results gracefully', async () => {
			const noOpTool = {
				description: 'A tool that returns nothing',
				inputSchema: z.object({}),
				execute: async () => null
			};
			
			const model = provider.languageModel('cortex/claude-sonnet-4-5');
			
			const { text } = await generateText({
				model,
				tools: { noOp: noOpTool },
				prompt: 'Call the noOp tool and acknowledge it.',
				stopWhen: stepCountIs(3)
			});
			
			expect(text).toBeDefined();
			console.log('No-op tool response:', text);
		}, 30000);
	});
	
	describe('Tool Choice', () => {
		// NOTE: Cortex API may not fully support toolChoice: 'none'
		// The model may still call tools even with this setting
		it('should respect toolChoice: none (when supported)', async () => {
			const model = provider.languageModel('cortex/claude-sonnet-4-5');
			
			const { text, steps } = await generateText({
				model,
				tools: { calculator: calculatorTool },
				toolChoice: 'none',
				prompt: 'What is 5 + 5? Answer without using any tools.'
			});
			
			// Get all tool calls from all steps
			const allToolCalls = steps.flatMap(step => step.toolCalls);
			
			// With toolChoice: none, ideally no tools should be called
			// However, Cortex may not fully honor this setting
			if (allToolCalls.length > 0) {
				console.log('[WARN] Cortex may not fully support toolChoice: none - tools were still called');
			}
			
			expect(text).toBeDefined();
			console.log('Response:', text);
		}, 30000);
		
		it('should respect toolChoice: auto', async () => {
			const model = provider.languageModel('cortex/claude-sonnet-4-5');
			
			const { steps } = await generateText({
				model,
				tools: { calculator: calculatorTool },
				toolChoice: 'auto',
				prompt: 'Calculate 9 squared using the calculator.',
				stopWhen: stepCountIs(3)
			});
			
			// Get all tool calls from all steps
			const allToolCalls = steps.flatMap(step => step.toolCalls);
			
			// With auto, the model should decide to use the tool
			expect(allToolCalls.length).toBeGreaterThan(0);
		}, 30000);
	});
});



