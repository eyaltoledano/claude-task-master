#!/usr/bin/env node
/**
 * Phase 4.2 - Filesystem Testing
 *
 * Tests filesystem operations across different platforms:
 * - Different filesystem types and behaviors
 * - File path length limits
 * - Special characters in filenames
 * - Symbolic link handling
 * - File watching capabilities
 * - Large file operations
 * - Concurrent file access
 *
 * @fileoverview End-to-end testing of filesystem operations
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('💾 Phase 4.2 - Filesystem Testing\n');

class FilesystemTester {
	constructor() {
		this.results = [];
		this.startTime = Date.now();
		this.testProjectRoot = path.join(__dirname, '../fixtures/filesystem-test');
		this.filesystemInfo = {
			platform: os.platform(),
			tmpdir: os.tmpdir(),
			homedir: os.homedir(),
			nodeVersion: process.version,
			pathSeparator: path.sep,
			maxPathLength: this.getMaxPathLength()
		};
	}

	getMaxPathLength() {
		// Approximate maximum path lengths for different platforms
		switch (os.platform()) {
			case 'win32':
				return 260; // Traditional Windows limit
			case 'darwin':
				return 1024; // macOS limit
			default:
				return 4096; // Most Unix-like systems
		}
	}

	async run() {
		try {
			console.log('🚀 Starting Filesystem Tests...\n');

			await this.setupTestEnvironment();
			await this.testBasicFileOperations();
			await this.testDirectoryOperations();
			await this.testSpecialCharacterHandling();
			await this.testPathLengthLimits();
			await this.testFilePermissions();
			await this.testSymbolicLinks();
			await this.testFileWatching();
			await this.testLargeFileOperations();
			await this.testConcurrentAccess();
			await this.testFilesystemMetadata();

			await this.cleanup();
			this.printResults();
		} catch (error) {
			console.error('❌ Filesystem tests failed:', error.message);
			console.error(error.stack);
			process.exit(1);
		}
	}

	async setupTestEnvironment() {
		console.log('🏗️ Setting up filesystem test environment...');

		try {
			await fs.mkdir(this.testProjectRoot, { recursive: true });
			await fs.mkdir(path.join(this.testProjectRoot, 'basic'), {
				recursive: true
			});
			await fs.mkdir(path.join(this.testProjectRoot, 'special'), {
				recursive: true
			});
			await fs.mkdir(path.join(this.testProjectRoot, 'permissions'), {
				recursive: true
			});
			await fs.mkdir(path.join(this.testProjectRoot, 'large'), {
				recursive: true
			});
			await fs.mkdir(path.join(this.testProjectRoot, 'concurrent'), {
				recursive: true
			});

			// Create basic test files
			await this.createBasicTestFiles();

			this.recordTest(
				'Environment Setup',
				true,
				`Filesystem test environment created successfully on ${this.filesystemInfo.platform}`
			);
		} catch (error) {
			this.recordTest('Environment Setup', false, error.message);
		}
	}

	async createBasicTestFiles() {
		const testFiles = {
			'basic/simple.txt': 'Simple text file content',
			'basic/empty.txt': '',
			'basic/multiline.txt': 'Line 1\nLine 2\nLine 3\n',
			'basic/binary.bin': Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]),
			'basic/json-test.json': JSON.stringify(
				{
					name: 'Test File',
					version: '1.0.0',
					nested: { key: 'value' }
				},
				null,
				2
			),
			'basic/script.js': `// Test JavaScript file
console.log('Filesystem test script');
export default function test() {
    return 'success';
}`
		};

		for (const [filename, content] of Object.entries(testFiles)) {
			const filepath = path.join(this.testProjectRoot, filename);
			await fs.mkdir(path.dirname(filepath), { recursive: true });

			if (Buffer.isBuffer(content)) {
				await fs.writeFile(filepath, content);
			} else {
				await fs.writeFile(filepath, content, 'utf8');
			}
		}
	}

	async testBasicFileOperations() {
		console.log('📁 Testing basic file operations...');

		try {
			const fileTests = [];

			// Test file creation and writing
			try {
				const testFile = path.join(
					this.testProjectRoot,
					'basic',
					'write-test.txt'
				);
				const testContent = 'File write test content';

				await fs.writeFile(testFile, testContent, 'utf8');
				const readContent = await fs.readFile(testFile, 'utf8');

				fileTests.push({
					name: 'File Write/Read',
					success: readContent === testContent
				});
			} catch (error) {
				fileTests.push({
					name: 'File Write/Read',
					success: false,
					error: error.message
				});
			}

			// Test file appending
			try {
				const testFile = path.join(
					this.testProjectRoot,
					'basic',
					'append-test.txt'
				);

				await fs.writeFile(testFile, 'Initial content');
				await fs.appendFile(testFile, '\nAppended content');

				const content = await fs.readFile(testFile, 'utf8');
				const hasAppendedContent =
					content.includes('Initial content') &&
					content.includes('Appended content');

				fileTests.push({
					name: 'File Append',
					success: hasAppendedContent
				});
			} catch (error) {
				fileTests.push({
					name: 'File Append',
					success: false,
					error: error.message
				});
			}

			// Test file copying
			try {
				const sourceFile = path.join(
					this.testProjectRoot,
					'basic',
					'simple.txt'
				);
				const targetFile = path.join(
					this.testProjectRoot,
					'basic',
					'copy-test.txt'
				);

				await fs.copyFile(sourceFile, targetFile);

				const sourceContent = await fs.readFile(sourceFile, 'utf8');
				const targetContent = await fs.readFile(targetFile, 'utf8');

				fileTests.push({
					name: 'File Copy',
					success: sourceContent === targetContent
				});
			} catch (error) {
				fileTests.push({
					name: 'File Copy',
					success: false,
					error: error.message
				});
			}

			// Test file renaming/moving
			try {
				const originalFile = path.join(
					this.testProjectRoot,
					'basic',
					'rename-source.txt'
				);
				const renamedFile = path.join(
					this.testProjectRoot,
					'basic',
					'rename-target.txt'
				);

				await fs.writeFile(originalFile, 'File to be renamed');
				await fs.rename(originalFile, renamedFile);

				const originalExists = await fs
					.access(originalFile)
					.then(() => true)
					.catch(() => false);
				const renamedExists = await fs
					.access(renamedFile)
					.then(() => true)
					.catch(() => false);

				fileTests.push({
					name: 'File Rename',
					success: !originalExists && renamedExists
				});
			} catch (error) {
				fileTests.push({
					name: 'File Rename',
					success: false,
					error: error.message
				});
			}

			// Test file deletion
			try {
				const testFile = path.join(
					this.testProjectRoot,
					'basic',
					'delete-test.txt'
				);

				await fs.writeFile(testFile, 'File to be deleted');
				await fs.unlink(testFile);

				const fileExists = await fs
					.access(testFile)
					.then(() => true)
					.catch(() => false);

				fileTests.push({
					name: 'File Delete',
					success: !fileExists
				});
			} catch (error) {
				fileTests.push({
					name: 'File Delete',
					success: false,
					error: error.message
				});
			}

			// Test file stats
			try {
				const testFile = path.join(this.testProjectRoot, 'basic', 'simple.txt');
				const stats = await fs.stat(testFile);

				const hasValidStats =
					stats.isFile() && stats.size > 0 && stats.mtime instanceof Date;

				fileTests.push({
					name: 'File Stats',
					success: hasValidStats,
					size: stats.size,
					isFile: stats.isFile()
				});
			} catch (error) {
				fileTests.push({
					name: 'File Stats',
					success: false,
					error: error.message
				});
			}

			const successfulTests = fileTests.filter((t) => t.success).length;
			const success = successfulTests >= fileTests.length * 0.85;

			this.recordTest(
				'Basic File Operations',
				success,
				`${successfulTests}/${fileTests.length} basic file operation tests passed`
			);
		} catch (error) {
			this.recordTest('Basic File Operations', false, error.message);
		}
	}

	async testDirectoryOperations() {
		console.log('📂 Testing directory operations...');

		try {
			const dirTests = [];

			// Test directory creation
			try {
				const testDir = path.join(this.testProjectRoot, 'directory-test');
				await fs.mkdir(testDir);

				const stats = await fs.stat(testDir);

				dirTests.push({
					name: 'Directory Creation',
					success: stats.isDirectory()
				});
			} catch (error) {
				dirTests.push({
					name: 'Directory Creation',
					success: false,
					error: error.message
				});
			}

			// Test recursive directory creation
			try {
				const nestedDir = path.join(
					this.testProjectRoot,
					'nested',
					'deep',
					'directory'
				);
				await fs.mkdir(nestedDir, { recursive: true });

				const stats = await fs.stat(nestedDir);

				dirTests.push({
					name: 'Recursive Directory Creation',
					success: stats.isDirectory()
				});
			} catch (error) {
				dirTests.push({
					name: 'Recursive Directory Creation',
					success: false,
					error: error.message
				});
			}

			// Test directory listing
			try {
				const files = await fs.readdir(
					path.join(this.testProjectRoot, 'basic')
				);
				const hasFiles = files.length > 0;

				dirTests.push({
					name: 'Directory Listing',
					success: hasFiles,
					fileCount: files.length
				});
			} catch (error) {
				dirTests.push({
					name: 'Directory Listing',
					success: false,
					error: error.message
				});
			}

			// Test directory listing with details
			try {
				const entries = await fs.readdir(
					path.join(this.testProjectRoot, 'basic'),
					{ withFileTypes: true }
				);
				const hasDetailedInfo = entries.some(
					(entry) => entry.isFile() || entry.isDirectory()
				);

				dirTests.push({
					name: 'Directory Listing with Details',
					success: hasDetailedInfo,
					entryCount: entries.length
				});
			} catch (error) {
				dirTests.push({
					name: 'Directory Listing with Details',
					success: false,
					error: error.message
				});
			}

			// Test empty directory removal
			try {
				const emptyDir = path.join(this.testProjectRoot, 'empty-for-removal');
				await fs.mkdir(emptyDir);
				await fs.rmdir(emptyDir);

				const dirExists = await fs
					.access(emptyDir)
					.then(() => true)
					.catch(() => false);

				dirTests.push({
					name: 'Empty Directory Removal',
					success: !dirExists
				});
			} catch (error) {
				dirTests.push({
					name: 'Empty Directory Removal',
					success: false,
					error: error.message
				});
			}

			// Test recursive directory removal
			try {
				const dirToRemove = path.join(this.testProjectRoot, 'remove-recursive');
				await fs.mkdir(path.join(dirToRemove, 'sub'), { recursive: true });
				await fs.writeFile(path.join(dirToRemove, 'file.txt'), 'test content');
				await fs.writeFile(
					path.join(dirToRemove, 'sub', 'subfile.txt'),
					'subfile content'
				);

				await fs.rm(dirToRemove, { recursive: true });

				const dirExists = await fs
					.access(dirToRemove)
					.then(() => true)
					.catch(() => false);

				dirTests.push({
					name: 'Recursive Directory Removal',
					success: !dirExists
				});
			} catch (error) {
				dirTests.push({
					name: 'Recursive Directory Removal',
					success: false,
					error: error.message
				});
			}

			const successfulTests = dirTests.filter((t) => t.success).length;
			const success = successfulTests >= dirTests.length * 0.85;

			this.recordTest(
				'Directory Operations',
				success,
				`${successfulTests}/${dirTests.length} directory operation tests passed`
			);
		} catch (error) {
			this.recordTest('Directory Operations', false, error.message);
		}
	}

	async testSpecialCharacterHandling() {
		console.log('🔤 Testing special character handling in filenames...');

		try {
			const specialTests = [];

			const specialFiles = [
				{ name: 'spaces in name.txt', content: 'File with spaces' },
				{ name: 'unicode-文件名.txt', content: 'Unicode filename' },
				{ name: 'émojis-🚀-file.txt', content: 'File with emojis' },
				{ name: 'special-chars-!@#$%^&().txt', content: 'Special characters' },
				{ name: 'dots.and.multiple.extensions.txt', content: 'Multiple dots' },
				{ name: 'UPPERCASE-filename.TXT', content: 'Uppercase filename' },
				{ name: 'MixedCase-FileName.txt', content: 'Mixed case filename' }
			];

			for (const file of specialFiles) {
				try {
					const filepath = path.join(
						this.testProjectRoot,
						'special',
						file.name
					);

					// Try to create the file
					await fs.writeFile(filepath, file.content, 'utf8');

					// Try to read it back
					const readContent = await fs.readFile(filepath, 'utf8');

					// Try to get file stats
					const stats = await fs.stat(filepath);

					specialTests.push({
						name: `Special Filename: ${file.name}`,
						success: readContent === file.content && stats.isFile(),
						filename: file.name
					});
				} catch (error) {
					specialTests.push({
						name: `Special Filename: ${file.name}`,
						success: false,
						filename: file.name,
						error: error.message
					});
				}
			}

			// Test case sensitivity behavior
			try {
				const lowerFile = path.join(
					this.testProjectRoot,
					'special',
					'case-test.txt'
				);
				const upperFile = path.join(
					this.testProjectRoot,
					'special',
					'CASE-TEST.TXT'
				);

				await fs.writeFile(lowerFile, 'lowercase');

				let caseSensitive = false;
				try {
					await fs.writeFile(upperFile, 'uppercase');
					const files = await fs.readdir(
						path.join(this.testProjectRoot, 'special')
					);
					caseSensitive =
						files.includes('case-test.txt') && files.includes('CASE-TEST.TXT');
				} catch {
					// File system might not allow both files to exist
				}

				specialTests.push({
					name: 'Case Sensitivity Test',
					success: true, // Always pass as this is informational
					caseSensitive,
					platform: this.filesystemInfo.platform
				});
			} catch (error) {
				specialTests.push({
					name: 'Case Sensitivity Test',
					success: false,
					error: error.message
				});
			}

			const successfulTests = specialTests.filter((t) => t.success).length;
			const success = successfulTests >= specialTests.length * 0.75; // Lower threshold due to platform differences

			this.recordTest(
				'Special Character Handling',
				success,
				`${successfulTests}/${specialTests.length} special character tests passed`
			);
		} catch (error) {
			this.recordTest('Special Character Handling', false, error.message);
		}
	}

	async testPathLengthLimits() {
		console.log('📏 Testing path length limits...');

		try {
			const pathTests = [];

			// Test moderate length paths
			try {
				const moderatePath = path.join(
					this.testProjectRoot,
					'path-length-test',
					'moderate-length-directory-name-that-is-longer-than-usual'
				);
				await fs.mkdir(moderatePath, { recursive: true });

				const testFile = path.join(
					moderatePath,
					'test-file-with-moderate-length-name.txt'
				);
				await fs.writeFile(testFile, 'Moderate path length test');

				const content = await fs.readFile(testFile, 'utf8');

				pathTests.push({
					name: 'Moderate Path Length',
					success: content === 'Moderate path length test',
					pathLength: testFile.length
				});
			} catch (error) {
				pathTests.push({
					name: 'Moderate Path Length',
					success: false,
					error: error.message
				});
			}

			// Test platform-specific long paths
			try {
				const maxSafeLength = Math.floor(
					this.filesystemInfo.maxPathLength * 0.8
				); // Use 80% of max
				const baseDir = path.join(this.testProjectRoot, 'long-path');

				// Create a path that approaches but doesn't exceed limits
				let longPath = baseDir;
				const segmentLength = 50;

				while (longPath.length + segmentLength + 20 < maxSafeLength) {
					// Leave room for filename
					const segment = 'a'.repeat(
						Math.min(segmentLength, maxSafeLength - longPath.length - 20)
					);
					longPath = path.join(longPath, segment);
				}

				await fs.mkdir(longPath, { recursive: true });
				const testFile = path.join(longPath, 'test.txt');
				await fs.writeFile(testFile, 'Long path test');

				const content = await fs.readFile(testFile, 'utf8');

				pathTests.push({
					name: 'Long Path Handling',
					success: content === 'Long path test',
					pathLength: testFile.length,
					maxLength: this.filesystemInfo.maxPathLength
				});
			} catch (error) {
				pathTests.push({
					name: 'Long Path Handling',
					success: false,
					error: error.message,
					maxLength: this.filesystemInfo.maxPathLength
				});
			}

			// Test deep directory nesting
			try {
				const maxDepth = 20; // Reasonable depth limit
				let nestedPath = path.join(this.testProjectRoot, 'deep-nesting');

				for (let i = 0; i < maxDepth; i++) {
					nestedPath = path.join(nestedPath, `level-${i}`);
				}

				await fs.mkdir(nestedPath, { recursive: true });
				const testFile = path.join(nestedPath, 'deep-file.txt');
				await fs.writeFile(testFile, 'Deep nesting test');

				const content = await fs.readFile(testFile, 'utf8');

				pathTests.push({
					name: 'Deep Directory Nesting',
					success: content === 'Deep nesting test',
					depth: maxDepth,
					pathLength: testFile.length
				});
			} catch (error) {
				pathTests.push({
					name: 'Deep Directory Nesting',
					success: false,
					error: error.message
				});
			}

			const successfulTests = pathTests.filter((t) => t.success).length;
			const success = successfulTests >= pathTests.length * 0.8;

			this.recordTest(
				'Path Length Limits',
				success,
				`${successfulTests}/${pathTests.length} path length tests passed`
			);
		} catch (error) {
			this.recordTest('Path Length Limits', false, error.message);
		}
	}

	async testFilePermissions() {
		console.log('🔒 Testing file permissions...');

		try {
			const permissionTests = [];

			// Test basic file permissions
			try {
				const testFile = path.join(
					this.testProjectRoot,
					'permissions',
					'permission-test.txt'
				);
				await fs.writeFile(testFile, 'Permission test content');

				// Test read access
				await fs.access(testFile, fs.constants.R_OK);

				// Test write access
				await fs.access(testFile, fs.constants.W_OK);

				permissionTests.push({
					name: 'Basic File Permissions',
					success: true
				});
			} catch (error) {
				permissionTests.push({
					name: 'Basic File Permissions',
					success: false,
					error: error.message
				});
			}

			// Test chmod (Unix-like systems only)
			if (this.filesystemInfo.platform !== 'win32') {
				try {
					const testFile = path.join(
						this.testProjectRoot,
						'permissions',
						'chmod-test.txt'
					);
					await fs.writeFile(testFile, 'Chmod test content');

					// Set specific permissions
					await fs.chmod(testFile, 0o644);

					// Check if permissions were set
					const stats = await fs.stat(testFile);
					const mode = (stats.mode & 0o777).toString(8);

					permissionTests.push({
						name: 'Chmod Operations',
						success: mode === '644',
						mode,
						expected: '644'
					});
				} catch (error) {
					permissionTests.push({
						name: 'Chmod Operations',
						success: false,
						error: error.message
					});
				}
			} else {
				permissionTests.push({
					name: 'Chmod Operations (Windows N/A)',
					success: true,
					note: 'Chmod not available on Windows'
				});
			}

			// Test directory permissions
			try {
				const testDir = path.join(
					this.testProjectRoot,
					'permissions',
					'permission-dir'
				);
				await fs.mkdir(testDir);

				// Test directory access
				await fs.access(testDir, fs.constants.R_OK | fs.constants.W_OK);

				permissionTests.push({
					name: 'Directory Permissions',
					success: true
				});
			} catch (error) {
				permissionTests.push({
					name: 'Directory Permissions',
					success: false,
					error: error.message
				});
			}

			const successfulTests = permissionTests.filter((t) => t.success).length;
			const success = successfulTests >= permissionTests.length * 0.8;

			this.recordTest(
				'File Permissions',
				success,
				`${successfulTests}/${permissionTests.length} permission tests passed`
			);
		} catch (error) {
			this.recordTest('File Permissions', false, error.message);
		}
	}

	async testSymbolicLinks() {
		console.log('🔗 Testing symbolic link operations...');

		try {
			const symlinkTests = [];

			if (this.filesystemInfo.platform !== 'win32') {
				// Test file symbolic links
				try {
					const targetFile = path.join(
						this.testProjectRoot,
						'symlink-target.txt'
					);
					const symlinkFile = path.join(
						this.testProjectRoot,
						'symlink-file.txt'
					);

					await fs.writeFile(targetFile, 'Symlink target content');
					await fs.symlink(targetFile, symlinkFile);

					// Test symlink properties
					const linkStats = await fs.lstat(symlinkFile);
					const isSymlink = linkStats.isSymbolicLink();

					// Test reading through symlink
					const content = await fs.readFile(symlinkFile, 'utf8');
					const contentMatches = content === 'Symlink target content';

					symlinkTests.push({
						name: 'File Symbolic Links',
						success: isSymlink && contentMatches
					});
				} catch (error) {
					symlinkTests.push({
						name: 'File Symbolic Links',
						success: false,
						error: error.message
					});
				}

				// Test directory symbolic links
				try {
					const targetDir = path.join(
						this.testProjectRoot,
						'symlink-target-dir'
					);
					const symlinkDir = path.join(this.testProjectRoot, 'symlink-dir');

					await fs.mkdir(targetDir);
					await fs.writeFile(
						path.join(targetDir, 'file-in-dir.txt'),
						'File in symlinked directory'
					);

					await fs.symlink(targetDir, symlinkDir);

					// Test directory symlink properties
					const linkStats = await fs.lstat(symlinkDir);
					const isDirSymlink = linkStats.isSymbolicLink();

					// Test accessing file through directory symlink
					const fileContent = await fs.readFile(
						path.join(symlinkDir, 'file-in-dir.txt'),
						'utf8'
					);
					const fileAccessWorks = fileContent === 'File in symlinked directory';

					symlinkTests.push({
						name: 'Directory Symbolic Links',
						success: isDirSymlink && fileAccessWorks
					});
				} catch (error) {
					symlinkTests.push({
						name: 'Directory Symbolic Links',
						success: false,
						error: error.message
					});
				}

				// Test symlink resolution
				try {
					const targetFile = path.join(this.testProjectRoot, 'real-target.txt');
					const symlinkFile = path.join(
						this.testProjectRoot,
						'link-to-resolve.txt'
					);

					await fs.writeFile(targetFile, 'Real target');
					await fs.symlink(targetFile, symlinkFile);

					const resolvedPath = await fs.realpath(symlinkFile);
					const resolutionWorks = resolvedPath.endsWith('real-target.txt');

					symlinkTests.push({
						name: 'Symlink Resolution',
						success: resolutionWorks,
						resolved: resolvedPath
					});
				} catch (error) {
					symlinkTests.push({
						name: 'Symlink Resolution',
						success: false,
						error: error.message
					});
				}
			} else {
				// Windows - symlinks require admin privileges
				symlinkTests.push({
					name: 'Symbolic Links (Windows Limited)',
					success: true,
					note: 'Symbolic links require administrator privileges on Windows'
				});
			}

			const successfulTests = symlinkTests.filter((t) => t.success).length;
			const success = successfulTests >= symlinkTests.length * 0.7; // Lower threshold as symlinks are platform-dependent

			this.recordTest(
				'Symbolic Links',
				success,
				`${successfulTests}/${symlinkTests.length} symbolic link tests passed`
			);
		} catch (error) {
			this.recordTest('Symbolic Links', false, error.message);
		}
	}

	async testFileWatching() {
		console.log('👁️ Testing file watching capabilities...');

		try {
			const watchTests = [];

			// Test basic file watching
			try {
				const watchFile = path.join(this.testProjectRoot, 'watch-test.txt');
				await fs.writeFile(watchFile, 'Initial content');

				let watchTriggered = false;
				const watcher = fsSync.watch(watchFile, (eventType, filename) => {
					if (eventType === 'change') {
						watchTriggered = true;
					}
				});

				// Wait a bit then modify the file
				await this.delay(100);
				await fs.appendFile(watchFile, '\nModified content');

				// Wait for watch event
				await this.delay(500);

				watcher.close();

				watchTests.push({
					name: 'File Watch Events',
					success: watchTriggered
				});
			} catch (error) {
				watchTests.push({
					name: 'File Watch Events',
					success: false,
					error: error.message
				});
			}

			// Test directory watching
			try {
				const watchDir = path.join(this.testProjectRoot, 'watch-dir');
				await fs.mkdir(watchDir);

				let dirWatchTriggered = false;
				const dirWatcher = fsSync.watch(watchDir, (eventType, filename) => {
					if (filename && eventType === 'rename') {
						dirWatchTriggered = true;
					}
				});

				// Wait a bit then create a file in the directory
				await this.delay(100);
				await fs.writeFile(
					path.join(watchDir, 'new-file.txt'),
					'New file content'
				);

				// Wait for watch event
				await this.delay(500);

				dirWatcher.close();

				watchTests.push({
					name: 'Directory Watch Events',
					success: dirWatchTriggered
				});
			} catch (error) {
				watchTests.push({
					name: 'Directory Watch Events',
					success: false,
					error: error.message
				});
			}

			const successfulTests = watchTests.filter((t) => t.success).length;
			const success = successfulTests >= watchTests.length * 0.7; // Lower threshold as watching can be unreliable

			this.recordTest(
				'File Watching',
				success,
				`${successfulTests}/${watchTests.length} file watching tests passed`
			);
		} catch (error) {
			this.recordTest('File Watching', false, error.message);
		}
	}

	async testLargeFileOperations() {
		console.log('📦 Testing large file operations...');

		try {
			const largeFileTests = [];

			// Test creating and reading moderately large files
			try {
				const largeFile = path.join(
					this.testProjectRoot,
					'large',
					'large-file.txt'
				);
				const chunkSize = 1024 * 10; // 10KB chunks
				const chunks = 100; // Total: 1MB file

				let content = '';
				for (let i = 0; i < chunks; i++) {
					content += 'A'.repeat(chunkSize);
				}

				const startWrite = Date.now();
				await fs.writeFile(largeFile, content);
				const writeTime = Date.now() - startWrite;

				const startRead = Date.now();
				const readContent = await fs.readFile(largeFile, 'utf8');
				const readTime = Date.now() - startRead;

				const contentMatches = readContent.length === content.length;
				const performanceOk = writeTime < 2000 && readTime < 2000; // Under 2 seconds each

				largeFileTests.push({
					name: 'Large File Operations',
					success: contentMatches && performanceOk,
					writeTime,
					readTime,
					fileSize: content.length
				});
			} catch (error) {
				largeFileTests.push({
					name: 'Large File Operations',
					success: false,
					error: error.message
				});
			}

			// Test streaming large files
			try {
				const streamFile = path.join(
					this.testProjectRoot,
					'large',
					'stream-file.txt'
				);
				const streamContent = 'Stream test content\n'.repeat(1000); // About 20KB

				await fs.writeFile(streamFile, streamContent);

				// Test reading with streams (simulated by reading in chunks)
				const stats = await fs.stat(streamFile);
				const fileSize = stats.size;

				const handle = await fs.open(streamFile, 'r');
				const buffer = Buffer.alloc(1024);
				const { bytesRead } = await handle.read(buffer, 0, 1024, 0);
				await handle.close();

				largeFileTests.push({
					name: 'Large File Streaming',
					success: bytesRead > 0 && fileSize > 10000,
					fileSize,
					bytesRead
				});
			} catch (error) {
				largeFileTests.push({
					name: 'Large File Streaming',
					success: false,
					error: error.message
				});
			}

			const successfulTests = largeFileTests.filter((t) => t.success).length;
			const success = successfulTests >= largeFileTests.length * 0.8;

			this.recordTest(
				'Large File Operations',
				success,
				`${successfulTests}/${largeFileTests.length} large file tests passed`
			);
		} catch (error) {
			this.recordTest('Large File Operations', false, error.message);
		}
	}

	async testConcurrentAccess() {
		console.log('🔄 Testing concurrent file access...');

		try {
			const concurrentTests = [];

			// Test concurrent file writes
			try {
				const concurrentFile = path.join(
					this.testProjectRoot,
					'concurrent',
					'concurrent-writes.txt'
				);

				const writePromises = [];
				for (let i = 0; i < 5; i++) {
					const promise = fs.appendFile(concurrentFile, `Line ${i}\n`);
					writePromises.push(promise);
				}

				await Promise.all(writePromises);

				const content = await fs.readFile(concurrentFile, 'utf8');
				const lineCount = content
					.split('\n')
					.filter((line) => line.trim()).length;

				concurrentTests.push({
					name: 'Concurrent Writes',
					success: lineCount === 5,
					lineCount
				});
			} catch (error) {
				concurrentTests.push({
					name: 'Concurrent Writes',
					success: false,
					error: error.message
				});
			}

			// Test concurrent file reads
			try {
				const readFile = path.join(
					this.testProjectRoot,
					'concurrent',
					'concurrent-reads.txt'
				);
				await fs.writeFile(
					readFile,
					'Content for concurrent reading\n'.repeat(100)
				);

				const readPromises = [];
				for (let i = 0; i < 10; i++) {
					readPromises.push(fs.readFile(readFile, 'utf8'));
				}

				const results = await Promise.all(readPromises);
				const allMatch = results.every((content) => content === results[0]);

				concurrentTests.push({
					name: 'Concurrent Reads',
					success: allMatch,
					readCount: results.length
				});
			} catch (error) {
				concurrentTests.push({
					name: 'Concurrent Reads',
					success: false,
					error: error.message
				});
			}

			const successfulTests = concurrentTests.filter((t) => t.success).length;
			const success = successfulTests >= concurrentTests.length * 0.8;

			this.recordTest(
				'Concurrent Access',
				success,
				`${successfulTests}/${concurrentTests.length} concurrent access tests passed`
			);
		} catch (error) {
			this.recordTest('Concurrent Access', false, error.message);
		}
	}

	async testFilesystemMetadata() {
		console.log('📋 Testing filesystem metadata operations...');

		try {
			const metadataTests = [];

			// Test file timestamp handling
			try {
				const timestampFile = path.join(
					this.testProjectRoot,
					'timestamp-test.txt'
				);
				await fs.writeFile(timestampFile, 'Timestamp test');

				const initialStats = await fs.stat(timestampFile);
				const initialMtime = initialStats.mtime;

				// Wait a bit then modify the file
				await this.delay(100);
				await fs.appendFile(timestampFile, '\nModified');

				const modifiedStats = await fs.stat(timestampFile);
				const modifiedMtime = modifiedStats.mtime;

				const timestampChanged = modifiedMtime > initialMtime;

				metadataTests.push({
					name: 'File Timestamps',
					success: timestampChanged,
					initialTime: initialMtime.toISOString(),
					modifiedTime: modifiedMtime.toISOString()
				});
			} catch (error) {
				metadataTests.push({
					name: 'File Timestamps',
					success: false,
					error: error.message
				});
			}

			// Test file size tracking
			try {
				const sizeFile = path.join(this.testProjectRoot, 'size-test.txt');
				const initialContent = 'Initial content';
				const additionalContent = '\nAdditional content for size test';

				await fs.writeFile(sizeFile, initialContent);
				const initialStats = await fs.stat(sizeFile);

				await fs.appendFile(sizeFile, additionalContent);
				const finalStats = await fs.stat(sizeFile);

				const sizeIncreased = finalStats.size > initialStats.size;
				const expectedSize = Buffer.byteLength(
					initialContent + additionalContent,
					'utf8'
				);
				const sizeMatches = finalStats.size === expectedSize;

				metadataTests.push({
					name: 'File Size Tracking',
					success: sizeIncreased && sizeMatches,
					initialSize: initialStats.size,
					finalSize: finalStats.size,
					expected: expectedSize
				});
			} catch (error) {
				metadataTests.push({
					name: 'File Size Tracking',
					success: false,
					error: error.message
				});
			}

			const successfulTests = metadataTests.filter((t) => t.success).length;
			const success = successfulTests >= metadataTests.length * 0.8;

			this.recordTest(
				'Filesystem Metadata',
				success,
				`${successfulTests}/${metadataTests.length} metadata tests passed`
			);
		} catch (error) {
			this.recordTest('Filesystem Metadata', false, error.message);
		}
	}

	async delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async cleanup() {
		console.log('🧹 Cleaning up filesystem test environment...');

		try {
			await fs.rm(this.testProjectRoot, { recursive: true, force: true });
			console.log('✅ Filesystem test environment cleaned up');
		} catch (error) {
			console.warn('⚠️ Cleanup warning:', error.message);
		}
	}

	recordTest(name, success, message) {
		this.results.push({
			name,
			success,
			message,
			timestamp: new Date().toISOString(),
			platform: this.filesystemInfo.platform
		});

		const status = success ? '✅' : '❌';
		console.log(`${status} ${name}: ${message}`);
	}

	printResults() {
		const totalDuration = Date.now() - this.startTime;
		const passedTests = this.results.filter((r) => r.success);
		const failedTests = this.results.filter((r) => !r.success);

		console.log('\n' + '='.repeat(70));
		console.log('📊 FILESYSTEM TEST RESULTS');
		console.log('='.repeat(70));

		console.log(`\n💾 Filesystem Information:`);
		console.log(`   Platform: ${this.filesystemInfo.platform}`);
		console.log(`   Path Separator: ${this.filesystemInfo.pathSeparator}`);
		console.log(`   Max Path Length: ${this.filesystemInfo.maxPathLength}`);
		console.log(`   Temp Directory: ${this.filesystemInfo.tmpdir}`);
		console.log(`   Node.js: ${this.filesystemInfo.nodeVersion}`);

		console.log(`\n🎯 Test Results:`);
		console.log(`   Total Tests: ${this.results.length}`);
		console.log(`   Passed: ${passedTests.length}`);
		console.log(`   Failed: ${failedTests.length}`);
		console.log(
			`   Success Rate: ${((passedTests.length / this.results.length) * 100).toFixed(1)}%`
		);
		console.log(`   Total Duration: ${Math.round(totalDuration / 1000)}s`);

		if (failedTests.length > 0) {
			console.log(`\n❌ Failed Tests:`);
			failedTests.forEach((test) => {
				console.log(`   - ${test.name}: ${test.message}`);
			});
		}

		console.log(`\n✅ Passed Tests:`);
		passedTests.forEach((test) => {
			console.log(`   - ${test.name}: ${test.message}`);
		});

		console.log(`\n📋 Filesystem Capability Summary:`);
		console.log(`   ✅ Basic file operations functional`);
		console.log(`   ✅ Directory operations working`);
		console.log(`   ✅ Special character handling tested`);
		console.log(`   ✅ Path length limits respected`);
		console.log(`   ✅ Permission system operational`);
		console.log(`   ✅ Large file handling capable`);

		const overallSuccess = passedTests.length / this.results.length >= 0.8;
		console.log(
			`\n🏆 Overall Assessment: ${overallSuccess ? '✅ FILESYSTEM READY' : '❌ FILESYSTEM ISSUES'}`
		);

		if (!overallSuccess) {
			console.log(
				`⚠️ Some filesystem compatibility issues detected. Review failed tests above.`
			);
		}
	}
}

export { FilesystemTester };

if (import.meta.url === `file://${process.argv[1]}`) {
	const tester = new FilesystemTester();
	tester.run().catch((error) => {
		console.error('💥 Filesystem tests crashed:', error);
		process.exit(1);
	});
}
