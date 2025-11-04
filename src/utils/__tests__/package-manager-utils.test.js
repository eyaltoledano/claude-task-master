/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	detectPackageManager,
	getPackageManagerExecutor,
	getSuggestedInstallCommand,
	getGlobalInstallCommand
} from '../package-manager-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Package Manager Utils', () => {
	let tempDir;

	beforeEach(() => {
		tempDir = path.join(__dirname, 'temp-test-pm', Date.now().toString());
		fs.mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('detectPackageManager', () => {
		test('detects pnpm from lockfile', () => {
			fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 5.4');
			expect(detectPackageManager(tempDir)).toBe('pnpm');
		});

		test('detects yarn from lockfile', () => {
			fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '# yarn lockfile');
			expect(detectPackageManager(tempDir)).toBe('yarn');
		});

		test('detects npm from lockfile', () => {
			fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
			expect(detectPackageManager(tempDir)).toBe('npm');
		});

		test('defaults to npm when no lockfile', () => {
			expect(detectPackageManager(tempDir)).toBe('npm');
		});

		test('detects from packageManager field in package.json', () => {
			const packageJson = { packageManager: 'pnpm@8.0.0' };
			fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
			expect(detectPackageManager(tempDir)).toBe('pnpm');
		});
	});

	describe('getPackageManagerExecutor', () => {
		test('returns pnpx for pnpm', () => {
			fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 5.4');
			expect(getPackageManagerExecutor(tempDir)).toBe('pnpx');
		});

		test('returns yarn for yarn', () => {
			fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '# yarn lockfile');
			expect(getPackageManagerExecutor(tempDir)).toBe('yarn');
		});

		test('returns npx for npm', () => {
			fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
			expect(getPackageManagerExecutor(tempDir)).toBe('npx');
		});
	});

	describe('getGlobalInstallCommand', () => {
		test('returns pnpm command for pnpm', () => {
			fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 5.4');
			expect(getGlobalInstallCommand('test-package', tempDir)).toBe('pnpm add -g test-package');
		});

		test('returns yarn command for yarn', () => {
			fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '# yarn lockfile');
			expect(getGlobalInstallCommand('test-package', tempDir)).toBe('yarn global add test-package');
		});

		test('returns npm command for npm', () => {
			fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
			expect(getGlobalInstallCommand('test-package', tempDir)).toBe('npm install -g test-package');
		});
	});

	describe('getSuggestedInstallCommand', () => {
		test('returns appropriate install command', () => {
			const command = getSuggestedInstallCommand('test-package', true);
			expect(command).toMatch(/^(npm install -g|pnpm add -g|yarn global add) test-package$/);
		});
	});
});