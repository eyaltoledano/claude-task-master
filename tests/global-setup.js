import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Build once for selected CLI suites, or use CI's downloaded artifact. */
export default function setup() {
	const projectRoot = fileURLToPath(new URL('../', import.meta.url));
	const cliPath = fileURLToPath(
		new URL('../dist/task-master.js', import.meta.url)
	);

	if (process.env.TASKMASTER_TEST_PREBUILT !== '1') {
		const options = {
			cwd: projectRoot,
			stdio: 'inherit',
			timeout: 120_000
		};
		if (process.env.npm_execpath) {
			execFileSync(
				process.execPath,
				[process.env.npm_execpath, 'run', 'build'],
				options
			);
		} else {
			// Direct Jest invocations may not have npm's lifecycle environment.
			execSync('npm run build', options);
		}
	}

	if (!existsSync(cliPath)) {
		throw new Error(
			'CLI build missing: dist/task-master.js. Build or download the current ' +
				"revision's artifacts before setting TASKMASTER_TEST_PREBUILT=1."
		);
	}
}
