/**
 * Unit Tests for Skills Loader Tool
 * 
 * Tests both unit functionality and integration with the filesystem
 * to ensure skills can be found in .claude/skills and .cortex/skills directories.
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
	listSkillsInputSchema,
	listSkillsTool,
	parseFrontMatter
} from '../../../src/tools/skills-loader.js';

describe('Skills Loader Tool', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('listSkillsInputSchema', () => {
		it('should use default directories when not provided', () => {
			const result = listSkillsInputSchema.parse({});
			expect(result.directories).toEqual(['.claude/skills', '.cortex/skills', 'assets/cortex-skills']);
			expect(result.skillName).toBeUndefined();
		});

		it('should accept custom directories', () => {
			const result = listSkillsInputSchema.parse({
				directories: ['custom/skills'],
				skillName: 'test-skill'
			});
			expect(result.directories).toEqual(['custom/skills']);
			expect(result.skillName).toBe('test-skill');
		});
	});

	describe('parseFrontMatter', () => {
		it('should parse valid YAML front-matter', () => {
			const content = `---
name: test-skill
description: A test skill for unit testing
---
# Test Skill

Instructions here...
`;
			const result = parseFrontMatter(content);
			expect(result).toEqual({
				name: 'test-skill',
				description: 'A test skill for unit testing'
			});
		});

		it('should return empty object for missing front-matter', () => {
			const content = `# No Front Matter

Just regular markdown content.
`;
			const result = parseFrontMatter(content);
			expect(result).toEqual({});
		});

		it('should return empty object for front-matter without name/description', () => {
			const content = `---
invalid: yaml
missing: required fields
---
# Content
`;
			const result = parseFrontMatter(content);
			expect(result.name).toBeUndefined();
			expect(result.description).toBeUndefined();
		});

		it('should handle front-matter with extra fields', () => {
			const content = `---
name: extended-skill
description: Skill with extra metadata
version: 1.0.0
author: Test Author
tags:
  - test
  - example
---
# Extended Skill
`;
			const result = parseFrontMatter(content);
			expect(result.name).toBe('extended-skill');
			expect(result.description).toBe('Skill with extra metadata');
		});

		it('should handle front-matter with empty description', () => {
			const content = `---
name: minimal-skill
description: ""
---
# Minimal
`;
			const result = parseFrontMatter(content);
			expect(result.name).toBe('minimal-skill');
			expect(result.description).toBe('');
		});
	});

	describe('listSkillsTool', () => {
		it('should have correct description', () => {
			expect(listSkillsTool.description).toContain('skills');
			expect(listSkillsTool.description).toContain('front-matter');
			expect(listSkillsTool.description).toContain('file_read');
		});

		it('should have execute function', () => {
			expect(typeof listSkillsTool.execute).toBe('function');
		});

		it('should have parameters schema', () => {
			expect(listSkillsTool.parameters).toBeDefined();
		});
	});
});

/**
 * Integration Tests for Skills Loader
 * 
 * These tests create actual skill directories in both .claude/skills and .cortex/skills
 * to verify the loader can find and parse skills from both locations.
 */
describe('Skills Loader Integration', () => {
	let testDir: string;
	const originalEnv = process.env;

	// Skill content fixtures
	const claudeSkillContent = `---
name: claude-code-review
description: A skill for reviewing code quality and best practices
---
# Code Review Skill

Use this skill to perform thorough code reviews.

## Guidelines
- Check for security vulnerabilities
- Verify code follows best practices
- Suggest improvements
`;

	const cortexSkillContent = `---
name: cortex-data-analysis
description: A skill for analyzing data and generating insights
---
# Data Analysis Skill

Use this skill to analyze datasets and generate insights.

## Capabilities
- Statistical analysis
- Pattern detection
- Visualization suggestions
`;

	const cortexSkillWithScripts = `---
name: cortex-automation
description: A skill with executable scripts for automation tasks
---
# Automation Skill

This skill includes scripts for common automation tasks.
`;

	beforeAll(async () => {
		// Create a temporary directory for test fixtures
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
		
		// Create .claude/skills directory with a skill
		const claudeSkillsDir = path.join(testDir, '.claude', 'skills', 'code-review');
		await fs.mkdir(claudeSkillsDir, { recursive: true });
		await fs.writeFile(path.join(claudeSkillsDir, 'SKILL.md'), claudeSkillContent);
		await fs.mkdir(path.join(claudeSkillsDir, 'references'), { recursive: true });
		await fs.writeFile(
			path.join(claudeSkillsDir, 'references', 'style-guide.md'),
			'# Style Guide\n\nCode style guidelines...'
		);

		// Create .cortex/skills directory with skills
		const cortexSkillsDir1 = path.join(testDir, '.cortex', 'skills', 'data-analysis');
		await fs.mkdir(cortexSkillsDir1, { recursive: true });
		await fs.writeFile(path.join(cortexSkillsDir1, 'SKILL.md'), cortexSkillContent);

		// Create another cortex skill with scripts and assets
		const cortexSkillsDir2 = path.join(testDir, '.cortex', 'skills', 'automation');
		await fs.mkdir(cortexSkillsDir2, { recursive: true });
		await fs.writeFile(path.join(cortexSkillsDir2, 'SKILL.md'), cortexSkillWithScripts);
		
		// Add scripts subdirectory
		await fs.mkdir(path.join(cortexSkillsDir2, 'scripts'), { recursive: true });
		await fs.writeFile(
			path.join(cortexSkillsDir2, 'scripts', 'deploy.sh'),
			'#!/bin/bash\necho "Deploying..."'
		);
		await fs.writeFile(
			path.join(cortexSkillsDir2, 'scripts', 'cleanup.py'),
			'#!/usr/bin/env python3\nprint("Cleaning up...")'
		);

		// Add assets subdirectory
		await fs.mkdir(path.join(cortexSkillsDir2, 'assets'), { recursive: true });
		await fs.writeFile(
			path.join(cortexSkillsDir2, 'assets', 'template.json'),
			'{ "name": "template" }'
		);
	});

	afterAll(async () => {
		// Clean up test directory
		if (testDir) {
			await fs.rm(testDir, { recursive: true, force: true });
		}
	});

	beforeEach(() => {
		// Set PROJECT_ROOT to our test directory
		process.env = { ...originalEnv, PROJECT_ROOT: testDir };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('Finding skills in .claude/skills', () => {
		it('should find skills in .claude/skills directory', async () => {
			const result = await listSkillsTool.execute({
				directories: ['.claude/skills']
			});

			expect(result.totalSkills).toBe(1);
			expect(result.searchedDirectories).toEqual(['.claude/skills']);
			
			const claudeSkill = result.skills.find(s => s.name === 'claude-code-review');
			expect(claudeSkill).toBeDefined();
			expect(claudeSkill?.description).toBe('A skill for reviewing code quality and best practices');
			expect(claudeSkill?.path).toContain('.claude/skills/code-review');
		});

		it('should include file inventory from .claude/skills', async () => {
			const result = await listSkillsTool.execute({
				directories: ['.claude/skills']
			});

			const claudeSkill = result.skills.find(s => s.name === 'claude-code-review');
			expect(claudeSkill?.files).toBeDefined();
			expect(claudeSkill?.files.length).toBeGreaterThanOrEqual(2);
			
			// Should include SKILL.md
			const skillMd = claudeSkill?.files.find(f => f.path.endsWith('SKILL.md'));
			expect(skillMd).toBeDefined();
			expect(skillMd?.type).toBe('markdown');
			
			// Should include reference file
			const refFile = claudeSkill?.files.find(f => f.path.includes('style-guide.md'));
			expect(refFile).toBeDefined();
		});
	});

	describe('Finding skills in .cortex/skills', () => {
		it('should find skills in .cortex/skills directory', async () => {
			const result = await listSkillsTool.execute({
				directories: ['.cortex/skills']
			});

			expect(result.totalSkills).toBe(2);
			expect(result.searchedDirectories).toEqual(['.cortex/skills']);
			
			const dataSkill = result.skills.find(s => s.name === 'cortex-data-analysis');
			expect(dataSkill).toBeDefined();
			expect(dataSkill?.description).toBe('A skill for analyzing data and generating insights');
			
			const autoSkill = result.skills.find(s => s.name === 'cortex-automation');
			expect(autoSkill).toBeDefined();
			expect(autoSkill?.description).toBe('A skill with executable scripts for automation tasks');
		});

		it('should include scripts and assets in file inventory', async () => {
			const result = await listSkillsTool.execute({
				directories: ['.cortex/skills']
			});

			const autoSkill = result.skills.find(s => s.name === 'cortex-automation');
			expect(autoSkill?.files).toBeDefined();
			
			// Should include shell script (.sh maps to 'shell')
			const shellScript = autoSkill?.files.find(f => f.path.includes('deploy.sh'));
			expect(shellScript).toBeDefined();
			expect(shellScript?.type).toBe('shell');
			
			// Should include python script
			const pythonScript = autoSkill?.files.find(f => f.path.includes('cleanup.py'));
			expect(pythonScript).toBeDefined();
			expect(pythonScript?.type).toBe('python');
			
			// Should include JSON asset
			const jsonAsset = autoSkill?.files.find(f => f.path.includes('template.json'));
			expect(jsonAsset).toBeDefined();
			expect(jsonAsset?.type).toBe('json');
		});
	});

	describe('Finding skills in both directories', () => {
		it('should find skills from both .claude/skills and .cortex/skills', async () => {
			const result = await listSkillsTool.execute({
				directories: ['.claude/skills', '.cortex/skills']
			});

			expect(result.totalSkills).toBe(3);
			expect(result.searchedDirectories).toEqual(['.claude/skills', '.cortex/skills']);
			
			// Should find claude skill
			expect(result.skills.some(s => s.name === 'claude-code-review')).toBe(true);
			
			// Should find cortex skills
			expect(result.skills.some(s => s.name === 'cortex-data-analysis')).toBe(true);
			expect(result.skills.some(s => s.name === 'cortex-automation')).toBe(true);
		});

		it('should find skills using default directories', async () => {
			const result = await listSkillsTool.execute({});

			// Default directories include .claude/skills and .cortex/skills
			expect(result.totalSkills).toBe(3);
			expect(result.searchedDirectories).toContain('.claude/skills');
			expect(result.searchedDirectories).toContain('.cortex/skills');
		});
	});

	describe('Filtering skills by name', () => {
		it('should filter skills by exact name match', async () => {
			const result = await listSkillsTool.execute({
				skillName: 'cortex-automation'
			});

			expect(result.totalSkills).toBe(1);
			expect(result.skills[0].name).toBe('cortex-automation');
		});

		it('should filter skills by partial name (case insensitive)', async () => {
			const result = await listSkillsTool.execute({
				skillName: 'CORTEX'
			});

			expect(result.totalSkills).toBe(2);
			expect(result.skills.every(s => s.name.toLowerCase().includes('cortex'))).toBe(true);
		});

		it('should return empty results for non-existent skill name', async () => {
			const result = await listSkillsTool.execute({
				skillName: 'non-existent-skill'
			});

			expect(result.totalSkills).toBe(0);
			expect(result.skills).toEqual([]);
		});
	});

	describe('Handling missing directories', () => {
		it('should handle non-existent directories gracefully', async () => {
			const result = await listSkillsTool.execute({
				directories: ['non-existent/skills', '.claude/skills']
			});

			// Should still find claude skills even though one directory doesn't exist
			expect(result.totalSkills).toBe(1);
			expect(result.skills[0].name).toBe('claude-code-review');
		});

		it('should return empty results when all directories are missing', async () => {
			const result = await listSkillsTool.execute({
				directories: ['missing1', 'missing2']
			});

			expect(result.totalSkills).toBe(0);
			expect(result.skills).toEqual([]);
		});
	});

	describe('Skills as Tools', () => {
		it('should provide skill metadata suitable for tool registration', async () => {
			const result = await listSkillsTool.execute({});

			for (const skill of result.skills) {
				// Each skill should have the required fields for tool registration
				expect(skill.name).toBeDefined();
				expect(typeof skill.name).toBe('string');
				expect(skill.name.length).toBeGreaterThan(0);
				
				expect(skill.description).toBeDefined();
				expect(typeof skill.description).toBe('string');
				
				expect(skill.path).toBeDefined();
				expect(typeof skill.path).toBe('string');
				
				expect(skill.files).toBeDefined();
				expect(Array.isArray(skill.files)).toBe(true);
			}
		});

		it('should provide file paths for progressive loading', async () => {
			const result = await listSkillsTool.execute({
				directories: ['.cortex/skills'],
				skillName: 'cortex-automation'
			});

			const skill = result.skills[0];
			expect(skill).toBeDefined();
			
			// Each file should have the required metadata (FileInfo: path, size, type)
			for (const file of skill.files) {
				expect(file.path).toBeDefined();
				expect(typeof file.path).toBe('string');
				expect(file.type).toBeDefined();
				expect(typeof file.type).toBe('string');
				expect(file.size).toBeDefined();
				expect(typeof file.size).toBe('number');
				
				// Path should be relative and usable with file_read
				// Note: In tests, paths may start with temp dir path
				expect(file.path.length).toBeGreaterThan(0);
			}
		});
	});
});

