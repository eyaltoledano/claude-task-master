import { expect, it, jest } from '@jest/globals';

const client = jest.fn();
let sdkLoads = 0;
jest.unstable_mockModule(
	'../../../src/ai-providers/gemini-cli-sdk/index.js',
	() => {
		sdkLoads++;
		return { createGeminiProvider: () => client };
	}
);

const { GeminiCliProvider } = await import(
	'../../../src/ai-providers/gemini-cli.js'
);

it('loads the Gemini SDK only when a client is requested', async () => {
	const provider = new GeminiCliProvider();
	expect(sdkLoads).toBe(0);
	expect(await provider.getClient({})).toBe(client);
	expect(sdkLoads).toBe(1);
});
