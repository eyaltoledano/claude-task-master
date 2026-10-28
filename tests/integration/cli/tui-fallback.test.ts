import { spawnSync } from 'node:child_process';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const cliPath = fileURLToPath(
	new URL('../../../dist/task-master.js', import.meta.url)
);
const { version } = JSON.parse(
	readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
);

describe('Published CLI without React', () => {
	let temporaryDirectory: string;
	let projectDirectory: string;
	let homeDirectory: string;
	let loaderUrl: string;

	beforeAll(() => {
		temporaryDirectory = mkdtempSync(
			join(tmpdir(), 'task-master-tui-fallback-')
		);
		projectDirectory = join(temporaryDirectory, 'project');
		homeDirectory = join(temporaryDirectory, 'home');
		mkdirSync(join(projectDirectory, '.taskmaster'), { recursive: true });
		mkdirSync(homeDirectory, { recursive: true });
		writeFileSync(
			join(projectDirectory, '.taskmaster', 'config.json'),
			JSON.stringify({ global: { anonymousTelemetry: false } })
		);

		// Force the missing-dependency condition even when a workspace installs React.
		const loaderPath = join(temporaryDirectory, 'without-react.mjs');
		writeFileSync(
			loaderPath,
			`export async function resolve(specifier, context, nextResolve) {
	if (specifier === 'react' || specifier.startsWith('react/')) {
		throw Object.assign(new Error("Cannot find package 'react' (disabled by test)"), {
			code: 'ERR_MODULE_NOT_FOUND'
		});
	}
	return nextResolve(specifier, context);
}
`
		);
		loaderUrl = pathToFileURL(loaderPath).href;
	});

	afterAll(() => {
		if (temporaryDirectory) {
			rmSync(temporaryDirectory, { recursive: true, force: true });
		}
	});

	/** Run the built entry point with isolated project and authentication state. */
	function runCLI(args: string[]) {
		const result = spawnSync(
			process.execPath,
			['--experimental-loader', loaderUrl, cliPath, ...args],
			{
				cwd: projectDirectory,
				env: {
					...process.env,
					HOME: homeDirectory,
					USERPROFILE: homeDirectory,
					NODE_OPTIONS: '',
					TASKMASTER_SKIP_AUTO_UPDATE: '1',
					FORCE_COLOR: '0'
				},
				encoding: 'utf8',
				timeout: 15_000,
				maxBuffer: 1024 * 1024
			}
		);

		expect(result.error).toBeUndefined();
		expect(result.signal).toBeNull();
		expect(result.stderr).not.toContain("Cannot find package 'react'");
		expect(result.status).toBe(0);
		return result.stdout;
	}

	it.each<[string, string[]]>([
		['no arguments', []],
		['tui', ['tui']],
		['repl', ['repl']]
	])(
		'shows the TUI fallback and help for %s',
		(_label, args) => {
			const output = runCLI(args);
			expect(output).toContain('TUI mode coming soon!');
			expect(output).toContain('Showing help instead...');
			expect(output).toContain('Task Master CLI');
		},
		20_000
	);

	it('shows help for --help', () => {
		expect(runCLI(['--help'])).toContain('Task Master CLI');
	}, 20_000);

	it('shows the package version for --version', () => {
		expect(runCLI(['--version']).trim().split(/\r?\n/)).toContain(version);
	}, 20_000);
});
