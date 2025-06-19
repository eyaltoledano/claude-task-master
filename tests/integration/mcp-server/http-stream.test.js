/**
 * Integration test for TaskMasterMCPServer HTTP stream endpoint
 */
import { jest } from '@jest/globals';
import net from 'net';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import TaskMasterMCPServer from '../../../mcp-server/src/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Add a mock tool to the server for testing
const toolHandler = jest.fn(
	async (args) => `Mocked response for mock_tool with ${JSON.stringify(args)}`
);
const mockTool = {
	name: 'mock_tool',
	description: 'A mock tool for testing',
	parameters: z.object({
		foo: z.string()
	}),
	execute: toolHandler
};

// Helper function to get a random port
function getRandomPort() {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.listen(0, () => {
			const port = server.address().port;
			server.close(() => resolve(port));
		});
	});
}

describe('TaskMasterMCPServer HTTP stream endpoint', () => {
	let server;
	let streamClient;
	let sseClient;
	let port;
	let streamTransport;
	let sseTransport;

	beforeAll(async () => {
		port = await getRandomPort();
		server = new TaskMasterMCPServer();
		await server.init();

		await server.server.addTool(mockTool);

		// Start server on the random port
		await server.start({
			transportType: 'httpStream',
			port
		});

		// Initialize client
		streamClient = new Client(
			{
				name: 'example-client',
				version: '1.0.0'
			},
			{
				capabilities: {}
			}
		);

		sseClient = new Client(
			{
				name: 'example-client',
				version: '1.0.0'
			},
			{
				capabilities: {}
			}
		);

		streamTransport = new StreamableHTTPClientTransport(
			new URL(`http://localhost:${port}/stream`)
		);

		sseTransport = new SSEClientTransport(
			new URL(`http://localhost:${port}/sse`)
		);

		await streamClient.connect(streamTransport);
		await sseClient.connect(sseTransport);
	});

	afterAll(async () => {
		if (sseTransport) await sseTransport.close();
		if (streamTransport) await streamTransport.close();
		if (server) await server.stop();
	});

	test('should list tools over HTTP stream', async () => {
		const response = await streamClient.listTools();
		expect(response.tools.map((t) => t.name)).toContain(mockTool.name);
	});

	test('should handle tool execution over HTTP stream', async () => {
		const response = await streamClient.callTool({
			name: 'mock_tool',
			arguments: { foo: 'bar' }
		});
		expect(response.content[0].text).toBe(
			'Mocked response for mock_tool with {"foo":"bar"}'
		);
	});

	test('should handle multiple tool executions in sequence', async () => {
		const responses = await Promise.all([
			streamClient.callTool({ name: 'mock_tool', arguments: { foo: 'first' } }),
			streamClient.callTool({
				name: 'mock_tool',
				arguments: { foo: 'second' }
			}),
			streamClient.callTool({ name: 'mock_tool', arguments: { foo: 'third' } })
		]);

		expect(responses.map((r) => r.content[0].text)).toEqual([
			'Mocked response for mock_tool with {"foo":"first"}',
			'Mocked response for mock_tool with {"foo":"second"}',
			'Mocked response for mock_tool with {"foo":"third"}'
		]);
	});

	test('should list tools over SSE', async () => {
		const response = await sseClient.listTools();
		expect(response.tools.map((t) => t.name)).toContain(mockTool.name);
	});

	test('should handle tool execution over SSE', async () => {
		const response = await sseClient.callTool({
			name: 'mock_tool',
			arguments: { foo: 'bar' }
		});
		expect(response.content[0].text).toBe(
			'Mocked response for mock_tool with {"foo":"bar"}'
		);
	});

	test('should handle multiple tool executions in sequence over SSE', async () => {
		const responses = await Promise.all([
			sseClient.callTool({ name: 'mock_tool', arguments: { foo: 'first' } }),
			sseClient.callTool({ name: 'mock_tool', arguments: { foo: 'second' } }),
			sseClient.callTool({ name: 'mock_tool', arguments: { foo: 'third' } })
		]);

		expect(responses.map((r) => r.content[0].text)).toEqual([
			'Mocked response for mock_tool with {"foo":"first"}',
			'Mocked response for mock_tool with {"foo":"second"}',
			'Mocked response for mock_tool with {"foo":"third"}'
		]);
	});
});
