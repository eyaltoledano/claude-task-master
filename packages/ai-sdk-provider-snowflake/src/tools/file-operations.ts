/**
 * File Operations Tools - Read-only codebase exploration
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type {
	TreeNode,
	ProjectTreeResult,
	FileReadResult,
	GrepMatch,
	GrepResult,
	ToolDefinition
} from './types.js';
import { escapeRegex } from '../utils/string-helpers.js';
import { getProjectRoot } from '../config/index.js';

/** Directories/files to ignore when traversing the file system */
const DEFAULT_IGNORE = [
	'node_modules',
	'.git',
	'dist',
	'coverage',
	'__pycache__',
	'.next',
	'build',
	'.env',
	'.DS_Store',
	'package-lock.json',
	'yarn.lock',
	'pnpm-lock.yaml'
];

/** Binary file extensions to skip in grep */
const BINARY_EXTENSIONS = new Set([
	'.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
	'.woff', '.woff2', '.ttf', '.eot', '.otf',
	'.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
	'.mp3', '.mp4', '.wav', '.avi', '.mov',
	'.exe', '.dll', '.so', '.dylib',
	'.pyc', '.pyo', '.class', '.o'
]);

/** Max file size to read in grep (1MB) */
const MAX_GREP_FILE_SIZE = 1_000_000;

/**
 * Validate that a path is within the project root (prevent directory traversal attacks)
 */
function isWithinProjectRoot(targetPath: string, projectRoot: string): boolean {
	const resolvedTarget = path.resolve(targetPath);
	const resolvedRoot = path.resolve(projectRoot);
	return resolvedTarget.startsWith(resolvedRoot + path.sep) || resolvedTarget === resolvedRoot;
}

/**
 * Resolve a path relative to project root, throwing if it escapes the root
 */
function safeResolvePath(inputPath: string, projectRoot: string): string {
	const targetPath = path.isAbsolute(inputPath) ? inputPath : path.join(projectRoot, inputPath);
	if (!isWithinProjectRoot(targetPath, projectRoot)) {
		throw new Error(`Access denied: path "${inputPath}" is outside project root`);
	}
	return targetPath;
}

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath: string, ignore: string[]): boolean {
	// Normalize path to use OS-specific separator, then split
	const normalized = path.normalize(filePath);
	const pathParts = normalized.split(path.sep);
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
	ignore: string[]
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
				const children = await buildTree(fullPath, basePath, maxDepth, currentDepth + 1, includeFiles, ignore);
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
					nodes.push({ name: entry.name, type: 'file', path: relativePath, size: stat.size });
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
 * Match filename against a glob-like pattern (* and ?)
 */
function matchPattern(filename: string, pattern: string): boolean {
	let regexPattern = '';
	for (const char of pattern) {
		if (char === '*') regexPattern += '.*';
		else if (char === '?') regexPattern += '.';
		else regexPattern += escapeRegex(char);
	}
	try {
		return new RegExp(`^${regexPattern}$`, 'i').test(filename);
	} catch {
		return filename.toLowerCase().includes(pattern.replace(/[*?]/g, '').toLowerCase());
	}
}

/**
 * Find files matching a pattern using Node.js recursive readdir
 */
async function findFiles(dir: string, pattern: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
		return entries
			.filter((e) => e.isFile())
			.filter((e) => !shouldIgnore(path.join(e.parentPath || dir, e.name), DEFAULT_IGNORE))
			.filter((e) => !BINARY_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
			.filter((e) => pattern === '*' || matchPattern(e.name, pattern))
			.map((e) => path.join(e.parentPath || dir, e.name));
	} catch {
		return [];
	}
}

/**
 * Search for pattern in file content
 */
async function grepFile(filePath: string, pattern: RegExp, contextLines: number): Promise<GrepMatch[]> {
	// Skip binary files
	if (BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
		return [];
	}

	try {
		// Skip files larger than limit
		const stat = await fs.stat(filePath);
		if (stat.size > MAX_GREP_FILE_SIZE) {
			return [];
		}

		const content = await fs.readFile(filePath, 'utf-8');
		const lines = content.split('\n');
		const matches: GrepMatch[] = [];

		for (let i = 0; i < lines.length; i++) {
			if (pattern.test(lines[i])) {
				matches.push({
					file: filePath,
					line: i + 1,
					content: lines[i],
					context: {
						before: lines.slice(Math.max(0, i - contextLines), i),
						after: lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines))
					}
				});
			}
		}
		return matches;
	} catch {
		return []; // Skip unreadable files
	}
}

// Input Schemas
export const projectTreeInputSchema = z.object({
	directory: z.string().default('.').describe('Directory to start from'),
	maxDepth: z.number().default(3).describe('Maximum depth to traverse'),
	includeFiles: z.boolean().default(true).describe('Include files in the tree')
});

export const fileReadInputSchema = z.object({
	path: z.string().describe('Path to the file'),
	startLine: z.number().optional().describe('Starting line number (1-indexed)'),
	endLine: z.number().optional().describe('Ending line number (1-indexed, inclusive)')
});

export const grepInputSchema = z.object({
	pattern: z.string().describe('Search pattern (regex supported)'),
	directory: z.string().default('.').describe('Directory to search in'),
	filePattern: z.string().default('*').describe('Glob pattern for files to search (e.g., "*.ts")'),
	contextLines: z.number().default(2).describe('Number of context lines before/after match'),
	maxMatches: z.number().default(50).describe('Maximum number of matches to return')
});

type ProjectTreeInput = z.infer<typeof projectTreeInputSchema>;
type FileReadInput = z.infer<typeof fileReadInputSchema>;
type GrepInput = z.infer<typeof grepInputSchema>;

/**
 * Project Tree Tool
 */
export const projectTreeTool: ToolDefinition<ProjectTreeInput, ProjectTreeResult> = {
	description: 'Generate a tree view of the project structure. Useful for understanding the codebase layout.',
	parameters: projectTreeInputSchema,
	execute: async (input: ProjectTreeInput): Promise<ProjectTreeResult> => {
		const { directory = '.', maxDepth = 3, includeFiles = true } = input;
		const projectRoot = getProjectRoot();
		const targetDir = safeResolvePath(directory, projectRoot);

		const { nodes, fileCount, dirCount } = await buildTree(
			targetDir, targetDir, maxDepth, 0, includeFiles, DEFAULT_IGNORE
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
 * File Read Tool
 */
export const fileReadTool: ToolDefinition<FileReadInput, FileReadResult> = {
	description: 'Read the contents of a file. Optionally specify line range to read only a portion.',
	parameters: fileReadInputSchema,
	execute: async (input: FileReadInput): Promise<FileReadResult> => {
		const { path: filePath, startLine, endLine } = input;
		const projectRoot = getProjectRoot();

		try {
			const targetPath = safeResolvePath(filePath, projectRoot);
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
					.map((line, i) => `${String(actualStartLine + i).padStart(6)}| ${line}`)
					.join('\n');
			} else {
				resultContent = lines.map((line, i) => `${String(i + 1).padStart(6)}| ${line}`).join('\n');
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
	description: 'Search for text patterns across files using regex. Returns matches with context lines.',
	parameters: grepInputSchema,
	execute: async (input: GrepInput): Promise<GrepResult> => {
		const { pattern, directory = '.', filePattern = '*', contextLines = 2, maxMatches = 50 } = input;
		const projectRoot = getProjectRoot();
		const targetDir = safeResolvePath(directory, projectRoot);

		let regex: RegExp;
		try {
			regex = new RegExp(pattern, 'gi');
		} catch {
			regex = new RegExp(escapeRegex(pattern), 'gi');
		}

		const files = await findFiles(targetDir, filePattern);
		const allMatches: GrepMatch[] = [];
		let hitLimit = false;

		for (const filePath of files) {
			if (allMatches.length >= maxMatches) {
				hitLimit = true;
				break;
			}

			const matches = await grepFile(filePath, regex, contextLines);
			for (const match of matches) {
				match.file = path.relative(targetDir, filePath);
				allMatches.push(match);
				if (allMatches.length >= maxMatches) {
					hitLimit = true;
					break;
				}
			}
		}

		return {
			pattern,
			directory: path.relative(projectRoot, targetDir) || '.',
			matches: allMatches.slice(0, maxMatches),
			totalMatches: allMatches.length,
			truncated: hitLimit
		};
	}
};

export { projectTreeTool as projectTree, fileReadTool as fileRead, grepTool as grep };
export default { projectTree: projectTreeTool, fileRead: fileReadTool, grep: grepTool };
