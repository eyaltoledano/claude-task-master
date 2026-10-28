import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const repositoryDirectory = fileURLToPath(
	new URL('../../../', import.meta.url)
);
const sdkUrl = new URL(
	'../../../src/ai-providers/gemini-cli-sdk/index.js',
	import.meta.url
).href;
const distributionUrl = new URL('../../../dist/', import.meta.url).href;

// Run outside Jest's VM so the real SDK and its transitive modules use Node's loader.
const childSource = String.raw`
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
process.chdir(process.env.TASKMASTER_GEMINI_PROJECT);

const requests = [];
globalThis.fetch = async (input, init = {}) => {
	const url = String(input);
	assert.equal(new URL(url).origin, 'https://generativelanguage.googleapis.com');
	assert.equal(init.method, 'POST');
	const body = JSON.parse(init.body);
	requests.push({ url, body });
	const response = {
		candidates: [{
			content: { role: 'model', parts: [{ text: '{"answer":42}' }] },
			finishReason: 'STOP'
		}],
		usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4, totalTokenCount: 7 },
		modelVersion: 'gemini-2.5-pro'
	};
	if (url.includes(':streamGenerateContent')) {
		return new Response('data: ' + JSON.stringify(response) + '\n\n', {
			status: 200,
			headers: { 'content-type': 'text/event-stream' }
		});
	}
	assert.match(url, /:generateContent$/);
	return new Response(JSON.stringify(response), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};

let sdk;
if (process.env.TASKMASTER_GEMINI_TARGET === 'source') {
	sdk = await import(process.env.TASKMASTER_GEMINI_SDK);
} else {
	const distribution = new URL(process.env.TASKMASTER_GEMINI_DIST);
	const candidates = readdirSync(distribution)
		.filter(name => name.endsWith('.js') && !['task-master.js', 'mcp-server.js'].includes(name))
		.filter(name => readFileSync(new URL(name, distribution), 'utf8').includes('createGeminiProvider'));
	for (const candidate of candidates) {
		const module = await import(new URL(candidate, distribution));
		if (typeof module.createGeminiProvider === 'function') {
			sdk = module;
			break;
		}
	}
	assert.ok(sdk, 'The built distribution must expose the real Gemini SDK chunk');
}
const { createGeminiProvider } = sdk;
const [{ generateObject, streamObject }, { z }] = await Promise.all([
	import('ai'),
	import('zod')
]);
const oauthModel = createGeminiProvider({ authType: 'oauth' })('gemini-2.5-pro');
assert.equal(oauthModel.provider, 'gemini-cli-core');
assert.equal(oauthModel.supportsStructuredOutputs, true);

const model = createGeminiProvider({
	authType: 'api-key', apiKey: 'isolated-test-key-never-sent'
})('gemini-2.5-pro');
assert.equal(model.supportsStructuredOutputs, true);
const schema = z.object({ answer: z.number() });
const options = {
	model,
	schema,
	system: 'Return the answer as a JSON object.',
	prompt: 'What is six times seven?',
	maxRetries: 0
};
const generated = await generateObject(options);
assert.deepEqual(generated.object, { answer: 42 });

const streamed = streamObject(options);
const partialObjects = [];
for await (const partialObject of streamed.partialObjectStream) {
	partialObjects.push(partialObject);
}
assert.deepEqual(await streamed.object, { answer: 42 });
assert.deepEqual(partialObjects.at(-1), { answer: 42 });

assert.equal(requests.length, 2);
for (const request of requests) {
	assert.equal(request.body.generationConfig.responseMimeType, 'application/json');
	assert.equal(request.body.generationConfig.responseJsonSchema.type, 'object');
	assert.equal(request.body.generationConfig.responseJsonSchema.properties.answer.type, 'number');
	assert.deepEqual(request.body.generationConfig.responseJsonSchema.required, ['answer']);
	assert.deepEqual(request.body.systemInstruction.parts, [{ text: options.system }]);
}
console.log(JSON.stringify({ node: process.version, requests, object: generated.object, streamed: await streamed.object }));
`;

describe('Gemini SDK on the supported Node runtime', () => {
	let temporaryDirectory: string;
	let projectDirectory: string;
	let homeDirectory: string;

	beforeAll(() => {
		temporaryDirectory = mkdtempSync(join(tmpdir(), 'task-master-gemini-sdk-'));
		projectDirectory = join(temporaryDirectory, 'project');
		homeDirectory = join(temporaryDirectory, 'home');
		mkdirSync(join(projectDirectory, '.taskmaster'), { recursive: true });
		mkdirSync(homeDirectory, { recursive: true });
		writeFileSync(
			join(projectDirectory, '.taskmaster', 'config.json'),
			JSON.stringify({ global: { anonymousTelemetry: false } })
		);
	});

	afterAll(() => {
		if (temporaryDirectory) {
			rmSync(temporaryDirectory, { recursive: true, force: true });
		}
	});

	it.each(['source', 'built'])(
		'loads the %s SDK and generates native structured output',
		(target) => {
			const environment = { ...process.env };
			for (const name of Object.keys(environment)) {
				if (
					/API_KEY|TOKEN|SECRET|CREDENTIAL|AUTH|GOOGLE_|GEMINI_|VERTEX_|OPENAI_|ANTHROPIC_|AZURE_|AWS_|PROXY|NODE_OPTIONS|DEBUG/i.test(
						name
					)
				) {
					delete environment[name];
				}
			}
			const result = spawnSync(
				process.execPath,
				['--input-type=module', '--eval', childSource],
				{
					cwd: repositoryDirectory,
					env: {
						...environment,
						HOME: homeDirectory,
						USERPROFILE: homeDirectory,
						XDG_CONFIG_HOME: homeDirectory,
						GEMINI_FORCE_FILE_STORAGE: 'true',
						OTEL_SDK_DISABLED: 'true',
						DO_NOT_TRACK: '1',
						TASKMASTER_SKIP_AUTO_UPDATE: '1',
						TASKMASTER_GEMINI_SDK: sdkUrl,
						TASKMASTER_GEMINI_DIST: distributionUrl,
						TASKMASTER_GEMINI_TARGET: target,
						TASKMASTER_GEMINI_PROJECT: projectDirectory,
						FORCE_COLOR: '0'
					},
					encoding: 'utf8',
					timeout: 30_000,
					maxBuffer: 1024 * 1024
				}
			);

			expect(result.error).toBeUndefined();
			expect(result.signal).toBeNull();
			if (result.status !== 0) {
				throw new Error(
					`Native SDK smoke failed (${result.status}): ${result.stderr}`
				);
			}
			const report = JSON.parse(result.stdout.trim());
			expect(report.node).toBe(process.version);
			expect(report.object).toEqual({ answer: 42 });
			expect(report.streamed).toEqual({ answer: 42 });
			expect(report.requests).toHaveLength(2);
		},
		35_000
	);
});
