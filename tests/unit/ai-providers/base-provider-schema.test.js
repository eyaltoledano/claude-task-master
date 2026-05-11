import { jest } from '@jest/globals';

const mockGenerateObject = jest.fn();
const mockJsonSchema = jest.fn((jsonSchema, options) => ({
	jsonSchema,
	validate: options?.validate
}));
const mockValidate = jest.fn();
const mockZodSchema = jest.fn(() => ({
	jsonSchema: {
		type: 'object',
		properties: {
			title: { type: 'string' },
			metadata: {
				type: 'object',
				properties: {
					priority: { type: 'string' }
				}
			},
			items: {
				// Some zod-to-json-schema conversions omit type when properties exist.
				properties: {
					id: { type: 'integer', minimum: 1 }
				}
			}
		}
	},
	validate: mockValidate
}));

jest.unstable_mockModule('ai', () => ({
	generateObject: mockGenerateObject,
	generateText: jest.fn(),
	streamObject: jest.fn(),
	streamText: jest.fn(),
	zodSchema: mockZodSchema,
	jsonSchema: mockJsonSchema,
	JSONParseError: class JSONParseError extends Error {},
	NoObjectGeneratedError: class NoObjectGeneratedError extends Error {
		static isInstance(error) {
			return error instanceof NoObjectGeneratedError;
		}
	}
}));

jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	isProxyEnabled: jest.fn(() => false)
}));

jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	findProjectRoot: jest.fn(() => '/mock/project'),
	log: jest.fn()
}));

jest.unstable_mockModule('../../../src/telemetry/sentry.js', () => ({
	getAITelemetryConfig: jest.fn(() => null),
	hashProjectRoot: jest.fn(() => 'mock-project-hash')
}));

const { BaseAIProvider } = await import(
	'../../../src/ai-providers/base-provider.js'
);

class TestProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Test Provider';
	}

	validateAuth() {}

	getRequiredApiKeyName() {
		return 'TEST_API_KEY';
	}

	getClient() {
		return (modelId) => ({ modelId });
	}
}

describe('BaseAIProvider structured output schema handling', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockGenerateObject.mockResolvedValue({
			object: { title: 'ok' },
			usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
		});
	});

	it('normalizes object schemas for OpenAI strict structured outputs', async () => {
		const provider = new TestProvider();

		await provider.generateObject({
			modelId: 'gpt-5.5',
			messages: [{ role: 'user', content: 'Generate a task' }],
			schema: { mocked: true },
			objectName: 'task'
		});

		expect(mockJsonSchema).toHaveBeenCalledTimes(1);
		const strictSchema = mockJsonSchema.mock.calls[0][0];

		expect(strictSchema).toMatchObject({
			type: 'object',
			additionalProperties: false,
			required: ['title', 'metadata', 'items'],
			properties: {
				metadata: {
					type: 'object',
					additionalProperties: false,
					required: ['priority']
				},
				items: {
					additionalProperties: false,
					required: ['id'],
					properties: {
						id: { type: 'integer' }
					}
				}
			}
		});

		// Preserve the existing integer-constraint sanitization behavior.
		expect(strictSchema.properties.items.properties.id.minimum).toBeUndefined();
	});

	it('preserves caller-defined required fields and normalizes edge-case schemas', async () => {
		mockZodSchema.mockReturnValueOnce({
			jsonSchema: {
				type: ['object', 'null'],
				required: ['title'],
				properties: {
					title: { type: 'string' },
					metadata: {
						type: ['object', 'null'],
						properties: {
							priority: { type: 'string' }
						}
					},
					steps: {
						type: 'array',
						items: [
							{ type: 'object', properties: { name: { type: 'string' } } },
							{ type: 'integer', minimum: 1 }
						]
					},
					choice: {
						type: 'object',
						properties: { value: { type: 'string' } },
						oneOf: [{ required: ['value'] }]
					}
				}
			},
			validate: mockValidate
		});
		const provider = new TestProvider();

		await provider.generateObject({
			modelId: 'gpt-5.5',
			messages: [{ role: 'user', content: 'Generate a task' }],
			schema: { mocked: true },
			objectName: 'task'
		});

		const strictSchema = mockJsonSchema.mock.calls[0][0];
		expect(strictSchema.required).toEqual(['title']);
		expect(strictSchema.properties.metadata).toMatchObject({
			type: ['object', 'null'],
			additionalProperties: false,
			required: ['priority']
		});
		expect(strictSchema.properties.steps.items[0]).toMatchObject({
			additionalProperties: false,
			required: ['name']
		});
		expect(strictSchema.properties.steps.items[1].minimum).toBeUndefined();
		expect(strictSchema.properties.choice.additionalProperties).toBeUndefined();
	});
});
