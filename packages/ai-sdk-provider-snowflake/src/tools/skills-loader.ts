/**
 * Skills Loader Tool - Lists available skills with YAML front-matter metadata
 * and file inventory for progressive loading. See https://github.com/anthropics/skills
 */

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getProjectRoot } from '../config/index.js';
import type {
	SkillMetadata,
	FileInfo,
	ListSkillsResult,
	ToolDefinition
} from './types.js';

/**
 * Get allowed skill paths (absolute, resolved)
 */
function getAllowedSkillPaths(projectRoot: string): string[] {
	return [
		path.resolve(projectRoot, '.claude', 'skills'),
		path.resolve(projectRoot, '.cortex', 'skills'),
		path.resolve(projectRoot, 'assets', 'cortex-skills'),
		path.join(os.homedir(), '.claude', 'skills'),
		path.join(os.homedir(), '.cortex', 'skills')
	];
}

/**
 * Parse YAML front-matter from markdown content
 * Exported for testing purposes
 */
export function parseFrontMatter(content: string): {
	name?: string;
	description?: string;
} {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return {};

	const yaml = match[1];
	const extract = (field: string) => {
		const m = yaml.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
		return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
	};

	return {
		name: extract('name'),
		description: extract('description')
	};
}

/**
 * Load skill metadata from a SKILL.md file
 */
async function loadSkillMetadata(skillDir: string): Promise<SkillMetadata | null> {
	try {
		const [content, entries] = await Promise.all([
			fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8'),
			fs.readdir(skillDir, { withFileTypes: true, recursive: true })
		]);
		
		const frontMatter = parseFrontMatter(content);
		const files = await Promise.all(
			entries
				.filter(e => e.isFile())
				.map(async e => {
					try {
						const fullPath = path.join(e.parentPath || skillDir, e.name);
						const stat = await fs.stat(fullPath);
						return { path: path.relative(skillDir, fullPath), size: stat.size };
					} catch {
						return null;
					}
				})
		).then(files => files.filter((f): f is FileInfo => f !== null));

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
 * Find all skills in allowed directories
 */
async function findSkills(
	searchPaths: string[],
	projectRoot: string
): Promise<SkillMetadata[]> {
	const results = await Promise.all(
		searchPaths.map(async (dir) => {
			try {
				const entries = await fs.readdir(dir, { withFileTypes: true });
				const skills = await Promise.all(
					entries
						.filter(e => e.isDirectory())
						.map(async e => {
							const skill = await loadSkillMetadata(path.join(dir, e.name));
							if (skill) skill.path = path.relative(projectRoot, skill.path) || skill.path;
							return skill;
						})
				);
				return skills.filter((s): s is SkillMetadata => s !== null);
			} catch {
				return [];
			}
		})
	);
	return results.flat();
}

/**
 * List Skills Tool Input Schema
 */
export const listSkillsInputSchema = z.object({
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
			'List available skills with metadata from YAML front-matter and complete file inventory. Searches project-local (.claude/skills, .cortex/skills, assets/cortex-skills) and home directories (~/.claude/skills, ~/.cortex/skills). Returns skill name, description, path, and ALL files in the skill folder. Use file_read to load specific files as needed.',
		parameters: listSkillsInputSchema,
		execute: async (input: ListSkillsInput): Promise<ListSkillsResult> => {
			const projectRoot = getProjectRoot();
			const searchPaths = getAllowedSkillPaths(projectRoot);
			let skills = await findSkills(searchPaths, projectRoot);

			if (input.skillName) {
				skills = skills.filter(s =>
					s.name.toLowerCase().includes(input.skillName!.toLowerCase())
				);
			}

			return {
				skills,
				totalSkills: skills.length,
				searchedDirectories: searchPaths
			};
		}
	};

/**
 * Export for use in tool sets
 */
export default listSkillsTool;
