import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRemoteBranches } from './git-utils.js';

const { execAsync } = vi.hoisted(() => ({ execAsync: vi.fn() }));

vi.mock('util', () => ({ promisify: () => execAsync }));

describe('getRemoteBranches', () => {
	beforeEach(() => {
		execAsync.mockReset();
	});

	it('preserves branch names containing HEAD', async () => {
		execAsync.mockResolvedValue({
			stdout: 'origin/fix/HEAD-request\norigin/HEAD-fix\norigin/feature/HEAD\n'
		});

		await expect(getRemoteBranches('/project')).resolves.toEqual([
			'fix/HEAD-request',
			'HEAD-fix',
			'feature/HEAD'
		]);
	});

	it('preserves branches whose remote name contains HEAD', async () => {
		execAsync.mockResolvedValue({ stdout: 'HEADquarters/main\n' });

		await expect(getRemoteBranches('/project')).resolves.toEqual(['main']);
	});

	it('excludes remote HEAD references', async () => {
		execAsync.mockResolvedValue({
			stdout: 'origin/HEAD\r\nupstream/HEAD\r\norigin/main\r\n'
		});

		await expect(getRemoteBranches('/project')).resolves.toEqual(['main']);
	});

	it('deduplicates branches and ignores empty lines', async () => {
		execAsync.mockResolvedValue({
			stdout: '\norigin/main\nupstream/main\n\norigin/feature/test\n'
		});

		await expect(getRemoteBranches('/project')).resolves.toEqual([
			'main',
			'feature/test'
		]);
	});

	it('returns an empty list when git fails', async () => {
		execAsync.mockRejectedValue(new Error('not a git repository'));

		await expect(getRemoteBranches('/project')).resolves.toEqual([]);
	});

	it('requires a project root without running git', async () => {
		await expect(getRemoteBranches('')).rejects.toThrow(
			'projectRoot is required for getRemoteBranches'
		);
		expect(execAsync).not.toHaveBeenCalled();
	});
});
