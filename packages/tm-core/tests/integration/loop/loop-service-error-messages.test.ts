import { describe, expect, it } from 'vitest';
import { LoopService } from '../../../src/modules/loop/services/loop.service.js';

function createErrnoException(message: string): NodeJS.ErrnoException {
	return Object.assign(new Error(message), {
		code: 'ENOENT' as const
	});
}

describe('LoopService error messaging', () => {
	it('should direct Claude CLI install errors to the official setup guide', () => {
		const service = new LoopService({ projectRoot: '/tmp/task-master' });

		const message = (
			service as unknown as {
				formatCommandError: (
					error: NodeJS.ErrnoException,
					command: string,
					sandbox: boolean
				) => string;
			}
		).formatCommandError(createErrnoException('spawn claude ENOENT'), 'claude', false);

		expect(message).toBe(
			'Claude Code CLI is not installed. Follow the official setup guide: https://docs.anthropic.com/en/docs/claude-code/getting-started'
		);
	});

	it('should preserve the Docker sandbox guidance for sandbox mode', () => {
		const service = new LoopService({ projectRoot: '/tmp/task-master' });

		const message = (
			service as unknown as {
				formatCommandError: (
					error: NodeJS.ErrnoException,
					command: string,
					sandbox: boolean
				) => string;
			}
		).formatCommandError(createErrnoException('spawn docker ENOENT'), 'docker', true);

		expect(message).toBe(
			'Docker is not installed. Install Docker Desktop to use --sandbox mode.'
		);
	});
});
