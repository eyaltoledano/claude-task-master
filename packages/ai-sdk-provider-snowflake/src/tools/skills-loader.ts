/**
 * Skills Loader Tool - Progressive Context Loading
 *
 * Lists available skills with metadata parsed from YAML front-matter.
 * Returns skill name, description, and complete file inventory for progressive loading.
 *
 * Skill Format (from https://github.com/anthropics/skills):
 * ```markdown
 * ---
 * name: skill-name
 * description: What the skill does and when to use it
 * ---
 * # Skill Title
 * Instructions loaded only after skill triggers...
 * ```
 *
 * Standard Skill Directory Structure:
 * ```
 * skill-name/
 * ├── SKILL.md          # Required - front-matter + instructions
 * ├── scripts/          # Executable code (Python/Bash)
 * ├── references/       # Documentation to load as needed
 * └── assets/           # Files used in output (templates, etc.)
 * ```
 */

import { z } from 'zod';
import type { SkillMetadata, FileInfo, ListSkillsResult } from './types.js';

/**
 * Tool definition type that works with AI SDK
 * Note: Using z.ZodType<TInput, z.ZodTypeDef, unknown> to allow schemas with defaults
 */
export interface ToolDefinition<TInput, TOutput> {
	description: string;
	parameters: z.ZodType<TInput, z.ZodTypeDef, unknown>;
	execute: (input: TInput) => Promise<TOutput>;
}

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
		sh: 'shell',
		bash: 'shell',
		json: 'json',
		yaml: 'yaml',
		yml: 'yaml',
		xml: 'xml',
		html: 'html',
		css: 'css',
		sql: 'sql',
		pdf: 'pdf',
		png: 'image',
		jpg: 'image',
		jpeg: 'image',
		gif: 'image',
		svg: 'image',
		ttf: 'font',
		woff: 'font',
		woff2: 'font'
	};
	return typeMap[ext] || 'unknown';
}

/**
 * Parse YAML front-matter from markdown content
 * Exported for testing purposes
 */
export function parseFrontMatter(content: string): {
	name?: string;
	description?: string;
} {
	const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/;
	const match = content.match(frontMatterRegex);

	if (!match) {
		return {};
	}

	const yaml = match[1];
	const result: { name?: string; description?: string } = {};

	// Simple YAML parsing for name and description
	const nameMatch = yaml.match(/^name:\s*(.+)$/m);
	if (nameMatch) {
		result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
	}

	const descMatch = yaml.match(/^description:\s*(.+)$/m);
	if (descMatch) {
		result.description = descMatch[1].trim().replace(/^["']|["']$/g, '');
	}

	return result;
}

/**
 * Recursively list all files in a directory
 */
async function listFilesRecursive(
	dir: string,
	basePath: string,
	fs: typeof import('fs/promises'),
	path: typeof import('path')
): Promise<FileInfo[]> {
	const files: FileInfo[] = [];

	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			const relativePath = path.relative(basePath, fullPath);

			if (entry.isDirectory()) {
				// Recursively list subdirectory
				const subFiles = await listFilesRecursive(fullPath, basePath, fs, path);
				files.push(...subFiles);
			} else if (entry.isFile()) {
				try {
					const stat = await fs.stat(fullPath);
					files.push({
						path: relativePath,
						size: stat.size,
						type: getFileType(entry.name),
						modified: stat.mtime
					});
				} catch {
					// Skip files we can't stat
				}
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}

	return files;
}

/**
 * Load skill metadata from a SKILL.md file
 */
async function loadSkillMetadata(
	skillDir: string,
	fs: typeof import('fs/promises'),
	path: typeof import('path')
): Promise<SkillMetadata | null> {
	const skillMdPath = path.join(skillDir, 'SKILL.md');

	try {
		const content = await fs.readFile(skillMdPath, 'utf-8');
		const frontMatter = parseFrontMatter(content);

		// Get all files in the skill directory
		const files = await listFilesRecursive(skillDir, skillDir, fs, path);

		return {
			name: frontMatter.name || path.basename(skillDir),
			description: frontMatter.description || 'No description available',
			path: skillDir,
			files
		};
	} catch {
		return null;
	}
}

/**
 * Find all skill directories in the given search directories
 */
async function findSkills(
	directories: string[],
	projectRoot: string,
	fs: typeof import('fs/promises'),
	path: typeof import('path')
): Promise<SkillMetadata[]> {
	const skills: SkillMetadata[] = [];

	for (const dir of directories) {
		const fullDir = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);

		try {
			const entries = await fs.readdir(fullDir, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory()) {
					const skillDir = path.join(fullDir, entry.name);
					const skill = await loadSkillMetadata(skillDir, fs, path);
					if (skill) {
						// Use relative path from project root for cleaner output
						skill.path = path.relative(projectRoot, skill.path) || skill.path;
						skills.push(skill);
					}
				}
			}
		} catch {
			// Directory doesn't exist, skip
		}
	}

	return skills;
}

/**
 * List Skills Tool Input Schema
 * Note: Using .default() without .optional() - Zod's .default() already handles undefined input
 */
export const listSkillsInputSchema = z.object({
	directories: z
		.array(z.string())
		.default(['.claude/skills', '.cortex/skills', 'assets/cortex-skills'])
		.describe('Directories to search for skills'),
	skillName: z
		.string()
		.optional()
		.describe('Filter to a specific skill by name')
});

type ListSkillsInput = z.infer<typeof listSkillsInputSchema>;

/**
 * List Skills Tool
 *
 * Lists available skills with metadata from YAML front-matter and complete file inventory.
 * Use file_read tool to load specific skill files as needed.
 */
export const listSkillsTool: ToolDefinition<ListSkillsInput, ListSkillsResult> =
	{
		description:
			'List available skills with metadata from YAML front-matter and complete file inventory. Returns skill name, description, path, and ALL files in the skill folder (including scripts/, references/, assets/ subdirectories). Use file_read to load specific files as needed.',
		parameters: listSkillsInputSchema,
		execute: async (input: ListSkillsInput): Promise<ListSkillsResult> => {
			const {
				directories = [
					'.claude/skills',
					'.cortex/skills',
					'assets/cortex-skills'
				],
				skillName
			} = input;
			// Dynamic imports for Node.js modules
			const fs = await import('fs/promises');
			const path = await import('path');

			// Get project root from environment or use current directory
			const projectRoot = process.env.PROJECT_ROOT || process.cwd();

			// Find all skills
			let skills = await findSkills(directories, projectRoot, fs, path);

			// Filter by name if specified
			if (skillName) {
				skills = skills.filter((s) =>
					s.name.toLowerCase().includes(skillName.toLowerCase())
				);
			}

			return {
				skills,
				totalSkills: skills.length,
				searchedDirectories: directories || []
			};
		}
	};

/**
 * Export for use in tool sets
 */
export default listSkillsTool;
