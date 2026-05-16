/**
 * @fileoverview Regression test for upstream issue #1683 (and #1638)
 *
 * Verifies that JS-side MCP tools which take a `tag` parameter
 * return that same tag back in their response payload, instead of
 * silently falling back to the `currentTag` from `.taskmaster/state.json`.
 *
 * Before the fix, `next_task(tag="phase3")` would respond with
 * `{ ..., "tag": "master" }` whenever state.json still pointed at master.
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTask } from '@tm/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('MCP response tag honors explicit tag arg (issue #1683)', () => {
	let testDir: string;
	let tasksPath: string;
	let statePath: string;
	let cliPath: string;
	let mcpServerPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-mcp-1683-'));
		process.chdir(testDir);

		cliPath = path.resolve(__dirname, '../../../../../dist/task-master.js');
		mcpServerPath = path.resolve(
			__dirname,
			'../../../../../dist/mcp-server.js'
		);

		execSync(`node "${cliPath}" init --yes`, {
			stdio: 'pipe',
			env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
		});

		tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
		statePath = path.join(testDir, '.taskmaster', 'state.json');

		// Multi-tag tasks file with master + phase3
		const data = {
			master: {
				tasks: [
					createTask({ id: 1, title: 'Master task', status: 'pending' })
				],
				metadata: {
					version: '1.0.0',
					lastModified: new Date().toISOString(),
					taskCount: 1,
					completedCount: 0,
					tags: ['master']
				}
			},
			phase3: {
				tasks: [
					createTask({
						id: 41,
						title: 'Phase3 task',
						status: 'pending',
						priority: 'high'
					})
				],
				metadata: {
					version: '1.0.0',
					lastModified: new Date().toISOString(),
					taskCount: 1,
					completedCount: 0,
					tags: ['phase3']
				}
			}
		};
		fs.writeFileSync(tasksPath, JSON.stringify(data, null, 2));

		// Pin currentTag to master so we can detect a fallback bug
		fs.writeFileSync(
			statePath,
			JSON.stringify({ currentTag: 'master' }, null, 2)
		);
	});

	afterEach(() => {
		try {
			process.chdir(path.resolve(__dirname, '../../../../..'));
		} catch {
			process.chdir(os.homedir());
		}
		if (testDir && fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	const callMCPTool = (
		toolName: string,
		args: Record<string, string>
	): any => {
		const toolArgs = Object.entries(args)
			.map(([key, value]) => `--tool-arg ${key}=${value}`)
			.join(' ');

		const output = execSync(
			`npx @modelcontextprotocol/inspector --cli node "${mcpServerPath}" --method tools/call --tool-name ${toolName} ${toolArgs}`,
			{ encoding: 'utf-8', stdio: 'pipe' }
		);
		const mcpResponse = JSON.parse(output);
		const resultText = mcpResponse.content[0].text;
		return JSON.parse(resultText);
	};

	it('next_task(tag="phase3") response carries tag="phase3" even when state.json points at master', () => {
		const data = callMCPTool('next_task', {
			projectRoot: testDir,
			tag: 'phase3'
		});
		expect(data.tag).toBe('phase3');
	}, 30000);
});
