import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type {
	Context7Config,
	Context7ToolsOptions,
	Context7ToolsResult
} from './types.js';

/**
 * Error thrown when Context7 API key is not configured
 */
export class Context7ApiKeyError extends Error {
	constructor() {
		super(
			'Context7 API key is required. Set CONTEXT7_API_KEY environment variable or pass apiKey in config.'
		);
		this.name = 'Context7ApiKeyError';
	}
}

/**
 * Get the Context7 API key from config or environment
 */
function getApiKey(config?: Context7Config): string {
	const apiKey = config?.apiKey ?? process.env.CONTEXT7_API_KEY;
	if (!apiKey) {
		throw new Context7ApiKeyError();
	}
	return apiKey;
}

/**
 * Creates a Context7 MCP client and returns tools for use with AI SDK.
 *
 * Context7 provides up-to-date documentation and code examples for libraries
 * and frameworks, helping AI models give more accurate answers about APIs.
 *
 * @example
 * ```typescript
 * import { createContext7Tools } from '@tm/ai-tools/context7';
 * import { generateText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * const { tools, close } = await createContext7Tools();
 *
 * try {
 *   const result = await generateText({
 *     model: openai('gpt-4o'),
 *     tools,
 *     prompt: 'How do I use the latest React Query API?',
 *   });
 *   console.log(result.text);
 * } finally {
 *   await close();
 * }
 * ```
 */
export async function createContext7Tools(
	options?: Context7ToolsOptions
): Promise<Context7ToolsResult> {
	const apiKey = getApiKey(options?.config);

	const transport = new Experimental_StdioMCPTransport({
		command: 'npx',
		args: ['-y', '@upstash/context7-mcp', '--api-key', apiKey]
	});

	const client = await experimental_createMCPClient({
		transport
	});

	options?.onReady?.();

	const tools = await client.tools();

	return {
		tools,
		close: async () => {
			await client.close();
		}
	};
}

/**
 * Check if Context7 is available (API key is configured)
 */
export function isContext7Available(config?: Context7Config): boolean {
	try {
		getApiKey(config);
		return true;
	} catch {
		return false;
	}
}
