/**
 * File Operations Tools
 *
 * Provides file search, read, grep, and project tree capabilities
 * for exploring and understanding the codebase.
 */

import { z } from 'zod';
import type {
	FileInfo,
	TreeNode,
	ProjectTreeResult,
	FileSearchResult,
	FileReadResult,
	GrepMatch,
	GrepResult,
	ToolDefinition
} from './types.js';

/**
 * Get file type based on extension
 */
function getFileType(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() || '';
	const typeMap: Record<string, string> = {
		md: 'markdown',
		txt: 'text',
		py: 'python',
		js: 'javascript',
		ts: 'typescript',
		jsx: 'javascript',
		tsx: 'typescript',
		sh: 'shell',
		bash: 'shell',
		json: 'json',
		yaml: 'yaml',
		yml: 'yaml',
		xml: 'xml',
		html: 'html',
		css: 'css',
		sql: 'sql',
		go: 'go',
		rs: 'rust',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		h: 'header',
		hpp: 'header'
	};
	return typeMap[ext] || 'unknown';
}

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath: string, ignore: string[]): boolean {
	const pathParts = filePath.split('/');
	return ignore.some((pattern) =>
		pathParts.some((part) => part === pattern || part.startsWith(pattern))
	);
}

/**
 * Build tree structure recursively
 */
async function buildTree(
	dir: string,
	basePath: string,
	maxDepth: number,
	currentDepth: number,
	includeFiles: boolean,
	ignore: string[],
	fs: typeof import('fs/promises'),
	path: typeof import('path')
): Promise<{ nodes: TreeNode[]; fileCount: number; dirCount: number }> {
	const nodes: TreeNode[] = [];
	let fileCount = 0;
	let dirCount = 0;

	if (currentDepth > maxDepth) return { nodes, fileCount, dirCount };

	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		entries.sort((a, b) => {
			if (a.isDirectory() && !b.isDirectory()) return -1;
			if (!a.isDirectory() && b.isDirectory()) return 1;
			return a.name.localeCompare(b.name);
		});

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			const relativePath = path.relative(basePath, fullPath);

			if (shouldIgnore(relativePath, ignore)) continue;

			if (entry.isDirectory()) {
				dirCount++;
				const children = await buildTree(
					fullPath,
					basePath,
					maxDepth,
					currentDepth + 1,
					includeFiles,
					ignore,
					fs,
					path
				);
				nodes.push({
					name: entry.name,
					type: 'directory',
					path: relativePath,
					children: children.nodes
				});
				fileCount += children.fileCount;
				dirCount += children.dirCount;
			} else if (entry.isFile() && includeFiles) {
				fileCount++;
				try {
					const stat = await fs.stat(fullPath);
					nodes.push({
						name: entry.name,
						type: 'file',
						path: relativePath,
						size: stat.size
					});
				} catch {
					nodes.push({ name: entry.name, type: 'file', path: relativePath });
				}
			}
		}
	} catch {
		/* Directory doesn't exist or can't be read */
	}

	return { nodes, fileCount, dirCount };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match files against a glob-like pattern
 * Converts simple glob patterns (* and ?) to regex safely
 */
function matchPattern(filename: string, pattern: string): boolean {
	// First, escape all special regex characters except our glob wildcards
	// We handle * and ? separately after escaping
	let regexPattern = '';
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i];
		if (char === '*') {
			regexPattern += '[^/]*'; // Match any char except path separator (non-greedy)
		} else if (char === '?') {
			regexPattern += '[^/]'; // Match single char except path separator
		} else {
			// Escape regex special characters
			regexPattern += escapeRegex(char);
		}
	}
	try {
		return new RegExp(`^${regexPattern}$`, 'i').test(filename);
	} catch {
		// Fallback to simple string matching
		return filename
			.toLowerCase()
			.includes(pattern.replace(/[*?]/g, '').toLowerCase());
	}
}

/**
 * Search for files matching a pattern
 */
async function searchFiles(
	dir: string,
	basePath: string,
	pattern: string,
	ignore: string[],
	maxResults: number,
	fs: typeof import('fs/promises'),
	path: typeof import('path')
): Promise<FileInfo[]> {
	const results: FileInfo[] = [];

	async function search(currentDir: string): Promise<void> {
		if (results.length >= maxResults) return;

		try {
			const entries = await fs.readdir(currentDir, { withFileTypes: true });

			for (const entry of entries) {
				if (results.length >= maxResults) break;

				const fullPath = path.join(currentDir, entry.name);
				const relativePath = path.relative(basePath, fullPath);

				if (shouldIgnore(relativePath, ignore)) continue;

				if (entry.isDirectory()) {
					await search(fullPath);
				} else if (entry.isFile()) {
					if (
						matchPattern(entry.name, pattern) ||
						matchPattern(relativePath, pattern)
					) {
						try {
							const stat = await fs.stat(fullPath);
							results.push({
								path: relativePath,
								size: stat.size,
								type: getFileType(entry.name),
								modified: stat.mtime
							});
						} catch {
							results.push({
								path: relativePath,
								size: 0,
								type: getFileType(entry.name)
							});
						}
					}
				}
			}
		} catch {
			/* Skip unreadable directories */
		}
	}

	await search(dir);
	return results;
}

/**
 * Search for pattern in file content
 */
async function grepFile(
	filePath: string,
	pattern: RegExp,
	contextLines: number,
	fs: typeof import('fs/promises')
): Promise<GrepMatch[]> {
	const matches: GrepMatch[] = [];

	try {
		const content = await fs.readFile(filePath, 'utf-8');
		const lines = content.split('\n');

		for (let i = 0; i < lines.length; i++) {
			if (pattern.test(lines[i])) {
				matches.push({
					file: filePath,
					line: i + 1,
					content: lines[i],
					context: {
						before: lines.slice(Math.max(0, i - contextLines), i),
						after: lines.slice(
							i + 1,
							Math.min(lines.length, i + 1 + contextLines)
						)
					}
				});
			}
		}
	} catch {
		/* Skip unreadable files */
	}

	return matches;
}

// Input Schemas
// Note: Using .default() without .optional() - Zod's .default() already handles undefined input
export const projectTreeInputSchema = z.object({
	directory: z.string().default('.').describe('Directory to start from'),
	maxDepth: z.number().default(3).describe('Maximum depth to traverse'),
	includeFiles: z.boolean().default(true).describe('Include files in the tree'),
	ignore: z
		.array(z.string())
		.default([
			'node_modules',
			'.git',
			'dist',
			'coverage',
			'__pycache__',
			'.next',
			'build'
		])
		.describe('Directories/files to ignore')
});

export const fileSearchInputSchema = z.object({
	pattern: z
		.string()
		.describe('Glob pattern to match (e.g., "*.ts", "test*.js")'),
	directory: z.string().default('.').describe('Directory to search in'),
	maxResults: z.number().default(50).describe('Maximum number of results')
});

export const fileReadInputSchema = z.object({
	path: z.string().describe('Path to the file'),
	startLine: z.number().optional().describe('Starting line number (1-indexed)'),
	endLine: z
		.number()
		.optional()
		.describe('Ending line number (1-indexed, inclusive)')
});

export const grepInputSchema = z.object({
	pattern: z.string().describe('Search pattern (regex supported)'),
	directory: z.string().default('.').describe('Directory to search in'),
	filePattern: z
		.string()
		.default('*')
		.describe('Glob pattern for files to search'),
	contextLines: z
		.number()
		.default(2)
		.describe('Number of context lines before/after match'),
	maxMatches: z
		.number()
		.default(50)
		.describe('Maximum number of matches to return')
});

type ProjectTreeInput = z.infer<typeof projectTreeInputSchema>;
type FileSearchInput = z.infer<typeof fileSearchInputSchema>;
type FileReadInput = z.infer<typeof fileReadInputSchema>;
type GrepInput = z.infer<typeof grepInputSchema>;

/**
 * Project Tree Tool
 */
export const projectTreeTool: ToolDefinition<
	ProjectTreeInput,
	ProjectTreeResult
> = {
	description:
		'Generate a tree view of the project structure. Useful for understanding the codebase layout.',
	parameters: projectTreeInputSchema,
	execute: async (input: ProjectTreeInput): Promise<ProjectTreeResult> => {
		const {
			directory = '.',
			maxDepth = 3,
			includeFiles = true,
			ignore = [
				'node_modules',
				'.git',
				'dist',
				'coverage',
				'__pycache__',
				'.next',
				'build'
			]
		} = input;
		const fs = await import('fs/promises');
		const path = await import('path');

		const projectRoot = process.env.PROJECT_ROOT || process.cwd();
		const targetDir = path.isAbsolute(directory)
			? directory
			: path.join(projectRoot, directory);

		const { nodes, fileCount, dirCount } = await buildTree(
			targetDir,
			targetDir,
			maxDepth,
			0,
			includeFiles,
			ignore,
			fs,
			path
		);

		return {
			root: path.relative(projectRoot, targetDir) || '.',
			tree: nodes,
			totalFiles: fileCount,
			totalDirectories: dirCount
		};
	}
};

/**
 * File Search Tool
 */
export const fileSearchTool: ToolDefinition<FileSearchInput, FileSearchResult> =
	{
		description:
			'Search for files matching a glob pattern (e.g., "*.ts", "**/*.test.js"). Returns file paths with metadata.',
		parameters: fileSearchInputSchema,
		execute: async (input: FileSearchInput): Promise<FileSearchResult> => {
			const { pattern, directory = '.', maxResults = 50 } = input;
			const fs = await import('fs/promises');
			const path = await import('path');

			const projectRoot = process.env.PROJECT_ROOT || process.cwd();
			const targetDir = path.isAbsolute(directory)
				? directory
				: path.join(projectRoot, directory);

			const defaultIgnore = [
				'node_modules',
				'.git',
				'dist',
				'coverage',
				'__pycache__',
				'.next',
				'build'
			];
			const matches = await searchFiles(
				targetDir,
				targetDir,
				pattern,
				defaultIgnore,
				maxResults + 1,
				fs,
				path
			);

			const truncated = matches.length > maxResults;
			const results = matches.slice(0, maxResults);

			return {
				pattern,
				directory: path.relative(projectRoot, targetDir) || '.',
				matches: results,
				totalMatches: results.length,
				truncated
			};
		}
	};

/**
 * File Read Tool
 */
export const fileReadTool: ToolDefinition<FileReadInput, FileReadResult> = {
	description:
		'Read the contents of a file. Optionally specify line range to read only a portion.',
	parameters: fileReadInputSchema,
	execute: async (input: FileReadInput): Promise<FileReadResult> => {
		const { path: filePath, startLine, endLine } = input;
		const fs = await import('fs/promises');
		const path = await import('path');

		const projectRoot = process.env.PROJECT_ROOT || process.cwd();
		const targetPath = path.isAbsolute(filePath)
			? filePath
			: path.join(projectRoot, filePath);

		try {
			const content = await fs.readFile(targetPath, 'utf-8');
			const lines = content.split('\n');
			const totalLines = lines.length;

			let resultContent: string;
			let actualStartLine = 1;
			let actualEndLine = totalLines;

			if (startLine !== undefined || endLine !== undefined) {
				actualStartLine = Math.max(1, startLine || 1);
				actualEndLine = Math.min(totalLines, endLine || totalLines);
				const selectedLines = lines.slice(actualStartLine - 1, actualEndLine);
				resultContent = selectedLines
					.map(
						(line, i) => `${String(actualStartLine + i).padStart(6)}| ${line}`
					)
					.join('\n');
			} else {
				resultContent = lines
					.map((line, i) => `${String(i + 1).padStart(6)}| ${line}`)
					.join('\n');
			}

			return {
				path: path.relative(projectRoot, targetPath) || filePath,
				content: resultContent,
				startLine: actualStartLine,
				endLine: actualEndLine,
				totalLines
			};
		} catch (error) {
			return {
				path: filePath,
				content: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
				totalLines: 0
			};
		}
	}
};

/**
 * Grep Tool
 */
export const grepTool: ToolDefinition<GrepInput, GrepResult> = {
	description:
		'Search for text patterns across files using regex. Returns matches with context lines.',
	parameters: grepInputSchema,
	execute: async (input: GrepInput): Promise<GrepResult> => {
		const {
			pattern,
			directory = '.',
			filePattern = '*',
			contextLines = 2,
			maxMatches = 50
		} = input;
		const fs = await import('fs/promises');
		const path = await import('path');

		const projectRoot = process.env.PROJECT_ROOT || process.cwd();
		const targetDir = path.isAbsolute(directory)
			? directory
			: path.join(projectRoot, directory);

		let regex: RegExp;
		try {
			regex = new RegExp(pattern, 'gi');
		} catch {
			regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
		}

		const defaultIgnore = [
			'node_modules',
			'.git',
			'dist',
			'coverage',
			'__pycache__',
			'.next',
			'build'
		];
		const files = await searchFiles(
			targetDir,
			targetDir,
			filePattern,
			defaultIgnore,
			1000,
			fs,
			path
		);

		const allMatches: GrepMatch[] = [];

		for (const file of files) {
			if (allMatches.length >= maxMatches) break;

			const fullPath = path.join(targetDir, file.path);
			const matches = await grepFile(fullPath, regex, contextLines, fs);

			for (const match of matches) {
				match.file = file.path;
				allMatches.push(match);
				if (allMatches.length >= maxMatches) break;
			}
		}

		return {
			pattern,
			directory: path.relative(projectRoot, targetDir) || '.',
			matches: allMatches.slice(0, maxMatches),
			totalMatches: allMatches.length,
			truncated: allMatches.length > maxMatches
		};
	}
};

export {
	projectTreeTool as projectTree,
	fileSearchTool as fileSearch,
	fileReadTool as fileRead,
	grepTool as grep
};
export default {
	projectTree: projectTreeTool,
	fileSearch: fileSearchTool,
	fileRead: fileReadTool,
	grep: grepTool
};
