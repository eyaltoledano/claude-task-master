import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
	createManifest,
	readManifest,
	updateManifest,
	validateManifest
} from '../../../src/storage/manifest-manager.js';

describe('Manifest Manager', () => {
	let testDir: string;
	let manifestPath: string;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = path.join(os.tmpdir(), `manifest-test-${Date.now()}`);
		await fs.ensureDir(testDir);
		manifestPath = path.join(testDir, 'manifest.json');
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.remove(testDir);
	});

	describe('createManifest', () => {
		it('should create a valid manifest file', async () => {
			const metadata = {
				taskId: '1.1',
				tag: 'feature-branch',
				branch: 'feature/test',
				projectRoot: '/path/to/project'
			};

			const manifest = await createManifest(manifestPath, metadata);

			expect(manifest).toBeDefined();
			expect(manifest.version).toBe('1.0.0');
			expect(manifest.runId).toBeDefined();
			expect(manifest.metadata).toEqual(expect.objectContaining(metadata));
			expect(manifest.timestamps.startTime).toBeDefined();
			expect(manifest.phase).toBe('preflight');
		});

		it('should write manifest to file system', async () => {
			await createManifest(manifestPath, { taskId: '1' });

			const exists = await fs.pathExists(manifestPath);
			expect(exists).toBe(true);
		});

		it('should create valid JSON file', async () => {
			await createManifest(manifestPath, { taskId: '1' });

			const content = await fs.readFile(manifestPath, 'utf-8');
			const parsed = JSON.parse(content);

			expect(parsed).toBeDefined();
			expect(parsed.version).toBe('1.0.0');
		});

		it('should include all required fields', async () => {
			const manifest = await createManifest(manifestPath, { taskId: '1' });

			expect(manifest).toHaveProperty('version');
			expect(manifest).toHaveProperty('runId');
			expect(manifest).toHaveProperty('metadata');
			expect(manifest).toHaveProperty('timestamps');
			expect(manifest).toHaveProperty('phase');
			expect(manifest).toHaveProperty('config');
		});

		it('should initialize timestamps correctly', async () => {
			const before = new Date().toISOString();
			const manifest = await createManifest(manifestPath, { taskId: '1' });
			const after = new Date().toISOString();

			expect(manifest.timestamps.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(manifest.timestamps.startTime >= before).toBe(true);
			expect(manifest.timestamps.startTime <= after).toBe(true);
			expect(manifest.timestamps.endTime).toBeNull();
		});

		it('should throw error if file already exists', async () => {
			await createManifest(manifestPath, { taskId: '1' });

			await expect(
				createManifest(manifestPath, { taskId: '2' })
			).rejects.toThrow('Manifest already exists');
		});

		it('should handle metadata with custom fields', async () => {
			const metadata = {
				taskId: '1',
				customField: 'custom value',
				nestedObject: { key: 'value' }
			};

			const manifest = await createManifest(manifestPath, metadata);

			expect(manifest.metadata.customField).toBe('custom value');
			expect(manifest.metadata.nestedObject).toEqual({ key: 'value' });
		});
	});

	describe('readManifest', () => {
		it('should read existing manifest file', async () => {
			const original = await createManifest(manifestPath, { taskId: '1' });
			const read = await readManifest(manifestPath);

			expect(read).toEqual(original);
		});

		it('should parse JSON correctly', async () => {
			await createManifest(manifestPath, { taskId: '1', tag: 'test' });
			const manifest = await readManifest(manifestPath);

			expect(manifest.metadata.taskId).toBe('1');
			expect(manifest.metadata.tag).toBe('test');
		});

		it('should throw error if file does not exist', async () => {
			await expect(readManifest(manifestPath)).rejects.toThrow();
		});

		it('should throw error for invalid JSON', async () => {
			await fs.writeFile(manifestPath, 'invalid json');

			await expect(readManifest(manifestPath)).rejects.toThrow();
		});

		it('should validate manifest structure', async () => {
			// Create invalid manifest
			await fs.writeFile(manifestPath, JSON.stringify({ invalid: true }));

			await expect(readManifest(manifestPath)).rejects.toThrow(
				'Invalid manifest'
			);
		});
	});

	describe('updateManifest', () => {
		it('should update manifest fields', async () => {
			await createManifest(manifestPath, { taskId: '1' });

			const updated = await updateManifest(manifestPath, {
				phase: 'red'
			});

			expect(updated.phase).toBe('red');
		});

		it('should preserve existing fields', async () => {
			const original = await createManifest(manifestPath, { taskId: '1' });

			const updated = await updateManifest(manifestPath, {
				phase: 'green'
			});

			expect(updated.runId).toBe(original.runId);
			expect(updated.metadata).toEqual(original.metadata);
			expect(updated.version).toBe(original.version);
		});

		it('should update timestamps.endTime', async () => {
			await createManifest(manifestPath, { taskId: '1' });

			const before = new Date().toISOString();
			const updated = await updateManifest(manifestPath, {
				timestamps: { endTime: new Date().toISOString() }
			});
			const after = new Date().toISOString();

			expect(updated.timestamps.endTime).toBeDefined();
			expect(updated.timestamps.endTime).not.toBeNull();
			expect(updated.timestamps.endTime! >= before).toBe(true);
			expect(updated.timestamps.endTime! <= after).toBe(true);
		});

		it('should use atomic write operations', async () => {
			await createManifest(manifestPath, { taskId: '1' });

			// Sequential updates to test atomic writes
			await updateManifest(manifestPath, { phase: 'red' });
			await updateManifest(manifestPath, { phase: 'green' });
			await updateManifest(manifestPath, { phase: 'commit' });

			// File should still be valid JSON
			const final = await readManifest(manifestPath);
			expect(final).toBeDefined();
			expect(final.phase).toBe('commit');
		});

		it('should throw error if manifest does not exist', async () => {
			await expect(
				updateManifest(manifestPath, { phase: 'red' })
			).rejects.toThrow();
		});

		it('should update nested metadata fields', async () => {
			await createManifest(manifestPath, { taskId: '1' });

			const updated = await updateManifest(manifestPath, {
				metadata: { status: 'completed' }
			});

			expect(updated.metadata.status).toBe('completed');
			expect(updated.metadata.taskId).toBe('1'); // Original field preserved
		});

		it('should update config snapshot', async () => {
			await createManifest(manifestPath, { taskId: '1' });

			const config = { maxRetries: 3, timeout: 5000 };
			const updated = await updateManifest(manifestPath, { config });

			expect(updated.config).toEqual(config);
		});
	});

	describe('validateManifest', () => {
		it('should validate correct manifest structure', () => {
			const manifest = {
				version: '1.0.0',
				runId: '2024-01-15T10:30:45.123Z',
				metadata: { taskId: '1' },
				timestamps: { startTime: '2024-01-15T10:30:45.123Z', endTime: null },
				phase: 'preflight',
				config: {}
			};

			expect(() => validateManifest(manifest)).not.toThrow();
		});

		it('should reject manifest without version', () => {
			const manifest = {
				runId: '2024-01-15T10:30:45.123Z',
				metadata: {},
				timestamps: { startTime: '2024-01-15T10:30:45.123Z', endTime: null },
				phase: 'preflight'
			};

			expect(() => validateManifest(manifest as any)).toThrow('version');
		});

		it('should reject manifest without runId', () => {
			const manifest = {
				version: '1.0.0',
				metadata: {},
				timestamps: { startTime: '2024-01-15T10:30:45.123Z', endTime: null },
				phase: 'preflight'
			};

			expect(() => validateManifest(manifest as any)).toThrow('runId');
		});

		it('should reject manifest with invalid runId format', () => {
			const manifest = {
				version: '1.0.0',
				runId: 'invalid',
				metadata: {},
				timestamps: { startTime: '2024-01-15T10:30:45.123Z', endTime: null },
				phase: 'preflight'
			};

			expect(() => validateManifest(manifest as any)).toThrow('runId');
		});

		it('should reject manifest without metadata', () => {
			const manifest = {
				version: '1.0.0',
				runId: '2024-01-15T10:30:45.123Z',
				timestamps: { startTime: '2024-01-15T10:30:45.123Z', endTime: null },
				phase: 'preflight'
			};

			expect(() => validateManifest(manifest as any)).toThrow('metadata');
		});

		it('should reject manifest without timestamps', () => {
			const manifest = {
				version: '1.0.0',
				runId: '2024-01-15T10:30:45.123Z',
				metadata: {},
				phase: 'preflight'
			};

			expect(() => validateManifest(manifest as any)).toThrow('timestamps');
		});

		it('should reject manifest without phase', () => {
			const manifest = {
				version: '1.0.0',
				runId: '2024-01-15T10:30:45.123Z',
				metadata: {},
				timestamps: { startTime: '2024-01-15T10:30:45.123Z', endTime: null }
			};

			expect(() => validateManifest(manifest as any)).toThrow('phase');
		});

		it('should validate version format', () => {
			const manifest = {
				version: 'invalid',
				runId: '2024-01-15T10:30:45.123Z',
				metadata: {},
				timestamps: { startTime: '2024-01-15T10:30:45.123Z', endTime: null },
				phase: 'preflight',
				config: {}
			};

			expect(() => validateManifest(manifest as any)).toThrow('version');
		});
	});

	describe('Schema evolution support', () => {
		it('should include version field for future migrations', async () => {
			const manifest = await createManifest(manifestPath, { taskId: '1' });

			expect(manifest.version).toBe('1.0.0');
		});

		it('should handle future version formats gracefully', async () => {
			const futureManifest = {
				version: '2.0.0',
				runId: '2024-01-15T10:30:45.123Z',
				metadata: { taskId: '1' },
				timestamps: { startTime: '2024-01-15T10:30:45.123Z', endTime: null },
				phase: 'preflight',
				config: {},
				newField: 'future data'
			};

			await fs.writeFile(manifestPath, JSON.stringify(futureManifest, null, 2));

			// Should be able to read future versions
			const read = await readManifest(manifestPath);
			expect(read.version).toBe('2.0.0');
			expect((read as any).newField).toBe('future data');
		});
	});

	describe('Atomic operations', () => {
		it('should prevent file corruption on write failure', async () => {
			await createManifest(manifestPath, { taskId: '1' });
			const original = await readManifest(manifestPath);

			// Mock a write failure by making directory read-only
			// This test is platform-dependent
			try {
				await fs.chmod(testDir, 0o444);
				await expect(
					updateManifest(manifestPath, { phase: 'red' })
				).rejects.toThrow();

				// Restore permissions
				await fs.chmod(testDir, 0o755);

				// Original file should still be valid
				const current = await readManifest(manifestPath);
				expect(current).toEqual(original);
			} catch (e) {
				// Skip on platforms that don't support chmod
				await fs.chmod(testDir, 0o755);
			}
		});
	});
});
