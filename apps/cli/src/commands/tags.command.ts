/**
 * @fileoverview Tags Command - Manage task organization with tags
 * Provides tag/brief management with file and API storage support
 */

import type { TmCore } from '@tm/core';
import { createTmCore, getProjectPaths } from '@tm/core';
import { Command } from 'commander';
import { displayError } from '../utils/index.js';

/**
 * TODO: TECH DEBT - Architectural Refactor Needed
 *
 * Current State:
 * - This command imports legacy JS functions from scripts/modules/task-manager/tag-management.js
 * - These functions contain business logic that violates architecture guidelines (see CLAUDE.md)
 *
 * Target State:
 * - Move all business logic to TagService in @tm/core
 * - CLI should only handle presentation (argument parsing, output formatting)
 * - Remove dependency on legacy scripts/ directory
 *
 * Complexity:
 * - Legacy functions handle both API and file storage via bridge pattern
 * - Need to migrate API integration logic to @tm/core first
 * - Affects MCP layer as well (should share same @tm/core APIs)
 *
 * Priority: Medium (improves testability, maintainability, and code reuse)
 */
import {
	copyTag as legacyCopyTag,
	createTag as legacyCreateTag,
	deleteTag as legacyDeleteTag,
	tags as legacyListTags,
	renameTag as legacyRenameTag,
	useTag as legacyUseTag
} from '../../../../scripts/modules/task-manager/tag-management.js';

/**
 * Result type from tags command
 */
export interface TagsResult {
	success: boolean;
	action: 'list' | 'add' | 'use' | 'remove' | 'rename' | 'copy';
	tags?: any[];
	currentTag?: string | null;
	message?: string;
}

/**
 * Legacy function return types
 */
interface LegacyListTagsResult {
	tags: any[];
	currentTag: string | null;
	totalTags: number;
}

interface LegacyUseTagResult {
	currentTag: string;
}

interface LegacyCreateTagOptions {
	description?: string;
	copyFromTag?: string;
	fromBranch?: boolean;
}

/**
 * TagsCommand - Manage tags/briefs for task organization
 */
export class TagsCommand extends Command {
	private tmCore?: TmCore;
	private lastResult?: TagsResult;
	private throwOnError: boolean = false;

	constructor(name?: string) {
		super(name || 'tags');

		// Configure the command
		this.description('Manage tags for task organization');

		// Add subcommands
		this.addListCommand();
		this.addAddCommand();
		this.addUseCommand();
		this.addRemoveCommand();
		this.addRenameCommand();
		this.addCopyCommand();

		// Default action: list tags
		this.action(async () => {
			await this.executeList();
		});
	}

	/**
	 * Add list subcommand
	 */
	private addListCommand(): void {
		this.command('list')
			.description('List all tags with statistics (default action)')
			.option('--show-metadata', 'Show additional tag metadata')
			.addHelpText(
				'after',
				`
Examples:
  $ tm tags          # List all tags (default)
  $ tm tags list     # List all tags (explicit)
  $ tm tags list --show-metadata  # List with metadata
`
			)
			.action(async (options) => {
				await this.executeList(options);
			});
	}

	/**
	 * Add add subcommand
	 */
	private addAddCommand(): void {
		this.command('add')
			.description('Create a new tag')
			.argument('<name>', 'Name of the tag to create')
			.option('--description <desc>', 'Tag description')
			.option('--copy-from <tag>', 'Copy tasks from another tag')
			.option('--from-branch', 'Create tag from current git branch name')
			.addHelpText(
				'after',
				`
Examples:
  $ tm tags add feature-auth         # Create new tag
  $ tm tags add sprint-2 --copy-from sprint-1  # Create with tasks copied
  $ tm tags add --from-branch        # Create from current git branch

Note: When using API storage, this will redirect you to the web UI to create a brief.
`
			)
			.action(async (name, options) => {
				await this.executeAdd(name, options);
			});
	}

	/**
	 * Add use subcommand
	 */
	private addUseCommand(): void {
		this.command('use')
			.description('Switch to a different tag')
			.argument('<name>', 'Name or ID of the tag to switch to')
			.addHelpText(
				'after',
				`
Examples:
  $ tm tags use feature-auth    # Switch by name
  $ tm tags use abc123          # Switch by ID (last 8 chars)

Note: For API storage, this switches the active brief in your context.
`
			)
			.action(async (name) => {
				await this.executeUse(name);
			});
	}

	/**
	 * Add remove subcommand
	 */
	private addRemoveCommand(): void {
		this.command('remove')
			.description('Remove a tag')
			.argument('<name>', 'Name or ID of the tag to remove')
			.option('-y, --yes', 'Skip confirmation prompt')
			.addHelpText(
				'after',
				`
Examples:
  $ tm tags remove old-feature      # Remove tag with confirmation
  $ tm tags remove old-feature -y   # Remove without confirmation

Warning: This will delete all tasks in the tag!
`
			)
			.action(async (name, options) => {
				await this.executeRemove(name, options);
			});
	}

	/**
	 * Add rename subcommand
	 */
	private addRenameCommand(): void {
		this.command('rename')
			.description('Rename a tag')
			.argument('<oldName>', 'Current tag name')
			.argument('<newName>', 'New tag name')
			.addHelpText(
				'after',
				`
Examples:
  $ tm tags rename old-name new-name
`
			)
			.action(async (oldName, newName) => {
				await this.executeRename(oldName, newName);
			});
	}

	/**
	 * Add copy subcommand
	 */
	private addCopyCommand(): void {
		this.command('copy')
			.description('Copy a tag with all its tasks')
			.argument('<source>', 'Source tag name')
			.argument('<target>', 'Target tag name')
			.option('--description <desc>', 'Description for the new tag')
			.addHelpText(
				'after',
				`
Examples:
  $ tm tags copy sprint-1 sprint-2
  $ tm tags copy sprint-1 sprint-2 --description "Next sprint tasks"
`
			)
			.action(async (source, target, options) => {
				await this.executeCopy(source, target, options);
			});
	}

	/**
	 * Initialize TmCore if not already initialized
	 * Required for bridge functions to work properly
	 */
	private async initTmCore(): Promise<void> {
		if (!this.tmCore) {
			this.tmCore = await createTmCore({
				projectPath: process.cwd()
			});
		}
	}

	/**
	 * Execute list tags
	 */
	private async executeList(options?: {
		showMetadata?: boolean;
	}): Promise<void> {
		try {
			// Initialize tmCore first (needed by bridge functions)
			await this.initTmCore();

			const { projectRoot, tasksPath } = getProjectPaths();

			// Use legacy function which handles both API and file storage
			const listResult = (await legacyListTags(
				tasksPath,
				{
					showTaskCounts: true,
					showMetadata: options?.showMetadata || false
				},
				{ projectRoot },
				'text'
			)) as LegacyListTagsResult;

			this.setLastResult({
				success: true,
				action: 'list',
				tags: listResult.tags,
				currentTag: listResult.currentTag,
				message: `Found ${listResult.totalTags} tag(s)`
			});
		} catch (error: any) {
			displayError(error);
			this.setLastResult({
				success: false,
				action: 'list',
				message: error.message
			});
			this.handleError(
				error instanceof Error
					? error
					: new Error(error.message || String(error))
			);
		}
	}

	/**
	 * Execute add tag
	 */
	private async executeAdd(
		name: string,
		options?: {
			description?: string;
			copyFrom?: string;
			fromBranch?: boolean;
		}
	): Promise<void> {
		try {
			// Initialize tmCore first (needed by bridge functions)
			await this.initTmCore();

			const { projectRoot, tasksPath } = getProjectPaths();

			// Use legacy function which handles both API and file storage
			await legacyCreateTag(
				tasksPath,
				name,
				{
					description: options?.description,
					copyFromTag: options?.copyFrom,
					fromBranch: options?.fromBranch
				} as LegacyCreateTagOptions,
				{ projectRoot },
				'text'
			);

			this.setLastResult({
				success: true,
				action: 'add',
				message: `Created tag: ${name}`
			});
		} catch (error: any) {
			displayError(error);
			this.setLastResult({
				success: false,
				action: 'add',
				message: error.message
			});
			this.handleError(
				error instanceof Error
					? error
					: new Error(error.message || String(error))
			);
		}
	}

	/**
	 * Execute use/switch tag
	 */
	private async executeUse(name: string): Promise<void> {
		try {
			// Initialize tmCore first (needed by bridge functions)
			await this.initTmCore();

			const { projectRoot, tasksPath } = getProjectPaths();

			// Use legacy function which handles both API and file storage
			const useResult = (await legacyUseTag(
				tasksPath,
				name,
				{},
				{ projectRoot },
				'text'
			)) as LegacyUseTagResult;

			this.setLastResult({
				success: true,
				action: 'use',
				currentTag: useResult.currentTag,
				message: `Switched to tag: ${name}`
			});
		} catch (error: any) {
			displayError(error);
			this.setLastResult({
				success: false,
				action: 'use',
				message: error.message
			});
			this.handleError(
				error instanceof Error
					? error
					: new Error(error.message || String(error))
			);
		}
	}

	/**
	 * Execute remove tag
	 */
	private async executeRemove(
		name: string,
		options?: { yes?: boolean }
	): Promise<void> {
		try {
			// Initialize tmCore first (needed by bridge functions)
			await this.initTmCore();

			const { projectRoot, tasksPath } = getProjectPaths();

			// Use legacy function which handles both API and file storage
			await legacyDeleteTag(
				tasksPath,
				name,
				{ yes: options?.yes || false },
				{ projectRoot },
				'text'
			);

			this.setLastResult({
				success: true,
				action: 'remove',
				message: `Removed tag: ${name}`
			});
		} catch (error: any) {
			displayError(error);
			this.setLastResult({
				success: false,
				action: 'remove',
				message: error.message
			});
			this.handleError(
				error instanceof Error
					? error
					: new Error(error.message || String(error))
			);
		}
	}

	/**
	 * Execute rename tag
	 */
	private async executeRename(oldName: string, newName: string): Promise<void> {
		try {
			// Initialize tmCore first (needed by bridge functions)
			await this.initTmCore();

			const { projectRoot, tasksPath } = getProjectPaths();

			// Use legacy function which handles both API and file storage
			await legacyRenameTag(
				tasksPath,
				oldName,
				newName,
				{},
				{ projectRoot },
				'text'
			);

			this.setLastResult({
				success: true,
				action: 'rename',
				message: `Renamed tag from "${oldName}" to "${newName}"`
			});
		} catch (error: any) {
			displayError(error);
			this.setLastResult({
				success: false,
				action: 'rename',
				message: error.message
			});
			this.handleError(
				error instanceof Error
					? error
					: new Error(error.message || String(error))
			);
		}
	}

	/**
	 * Execute copy tag
	 */
	private async executeCopy(
		source: string,
		target: string,
		options?: { description?: string }
	): Promise<void> {
		try {
			// Initialize tmCore first (needed by bridge functions)
			await this.initTmCore();

			const { projectRoot, tasksPath } = getProjectPaths();

			// Use legacy function which handles both API and file storage
			await legacyCopyTag(
				tasksPath,
				source,
				target,
				{ description: options?.description },
				{ projectRoot },
				'text'
			);

			this.setLastResult({
				success: true,
				action: 'copy',
				message: `Copied tag from "${source}" to "${target}"`
			});
		} catch (error: any) {
			displayError(error);
			this.setLastResult({
				success: false,
				action: 'copy',
				message: error.message
			});
			this.handleError(
				error instanceof Error
					? error
					: new Error(error.message || String(error))
			);
		}
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: TagsResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): TagsResult | undefined {
		return this.lastResult;
	}

	/**
	 * Enable throwing errors instead of process.exit for programmatic usage
	 * @param shouldThrow If true, throws errors; if false, calls process.exit (default)
	 */
	public setThrowOnError(shouldThrow: boolean): this {
		this.throwOnError = shouldThrow;
		return this;
	}

	/**
	 * Handle error by either exiting or throwing based on throwOnError flag
	 */
	private handleError(error: Error): never {
		if (this.throwOnError) {
			throw error;
		}
		process.exit(1);
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): TagsCommand {
		const tagsCommand = new TagsCommand(name);
		program.addCommand(tagsCommand);
		return tagsCommand;
	}
}
