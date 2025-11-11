/**
 * @fileoverview TagService - Business logic for tag management
 * Handles tag creation, deletion, renaming, and copying
 */

import type { IStorage } from '../../../common/interfaces/storage.interface.js';
import type { TagInfo } from '../../../common/interfaces/storage.interface.js';
import { TaskMasterError, ERROR_CODES } from '../../../common/errors/task-master-error.js';

/**
 * Options for creating a new tag
 */
export interface CreateTagOptions {
	/** Copy tasks from current tag */
	copyFromCurrent?: boolean;
	/** Copy tasks from specific tag */
	copyFromTag?: string;
	/** Tag description */
	description?: string;
	/** Create from git branch name */
	fromBranch?: boolean;
}

/**
 * Options for deleting a tag
 */
export interface DeleteTagOptions {
	/** Skip confirmation prompts */
	skipConfirmation?: boolean;
}

/**
 * Options for copying a tag
 */
export interface CopyTagOptions {
	/** Description for the new tag */
	description?: string;
}

/**
 * Reserved tag names that cannot be used
 */
const RESERVED_TAG_NAMES = ['master', 'main', 'default'];

/**
 * TagService - Handles tag management business logic
 * Validates operations and delegates to storage layer
 */
export class TagService {
	constructor(private storage: IStorage) {}

	/**
	 * Validate tag name format and restrictions
	 * @throws {TaskMasterError} if validation fails
	 */
	private validateTagName(name: string, context = 'Tag name'): void {
		if (!name || typeof name !== 'string') {
			throw new TaskMasterError(
				`${context} is required and must be a string`,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		// Check format: alphanumeric, hyphens, underscores only
		if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
			throw new TaskMasterError(
				`${context} can only contain letters, numbers, hyphens, and underscores`,
				ERROR_CODES.VALIDATION_ERROR,
				{ tagName: name }
			);
		}

		// Check reserved names
		if (RESERVED_TAG_NAMES.includes(name.toLowerCase())) {
			throw new TaskMasterError(
				`"${name}" is a reserved tag name`,
				ERROR_CODES.VALIDATION_ERROR,
				{ tagName: name, reserved: true }
			);
		}
	}

	/**
	 * Check if storage supports tag mutation operations
	 * @throws {TaskMasterError} if operation not supported
	 */
	private checkTagMutationSupport(operation: string): void {
		const storageType = this.storage.getStorageType();

		if (storageType === 'api') {
			throw new TaskMasterError(
				`${operation} is not supported with API storage. Use the web interface at Hamster Studio.`,
				ERROR_CODES.NOT_IMPLEMENTED,
				{ storageType: 'api', operation }
			);
		}
	}

	/**
	 * Create a new tag
	 * For API storage: throws error (client should redirect to web UI)
	 * For file storage: creates tag with optional task copying
	 */
	async createTag(
		name: string,
		options: CreateTagOptions = {}
	): Promise<TagInfo> {
		// Validate tag name
		this.validateTagName(name);

		// Check if tag already exists
		const allTags = await this.storage.getAllTags();
		if (allTags.includes(name)) {
			throw new TaskMasterError(
				`Tag "${name}" already exists`,
				ERROR_CODES.VALIDATION_ERROR,
				{ tagName: name }
			);
		}

		// For API storage, we can't create tags via CLI
		// The client (CLI/bridge) should handle redirecting to web UI
		this.checkTagMutationSupport('Tag creation');

		// Determine which tag to copy from
		let copyFrom: string | undefined;
		if (options.copyFromTag) {
			copyFrom = options.copyFromTag;
		} else if (options.copyFromCurrent) {
			// Get current tag from storage (for file storage, it's in state)
			// For now, we'll let the storage handle this if needed
			// TODO: May need to pass current tag context
			copyFrom = undefined; // Let storage decide
		}

		// Delegate to storage layer
		await this.storage.createTag(name, {
			copyFrom,
			description: options.description
		});

		// Return tag info
		const tagInfo: TagInfo = {
			name,
			taskCount: 0,
			completedTasks: 0,
			isCurrent: false,
			statusBreakdown: {},
			description: options.description || `Tag created on ${new Date().toLocaleDateString()}`
		};

		return tagInfo;
	}

	/**
	 * Delete an existing tag
	 * Cannot delete master tag
	 * For API storage: throws error (client should redirect to web UI)
	 */
	async deleteTag(
		name: string,
		_options: DeleteTagOptions = {}
	): Promise<void> {
		// Validate tag name
		this.validateTagName(name);

		// Cannot delete master tag
		if (name === 'master') {
			throw new TaskMasterError(
				'Cannot delete the "master" tag',
				ERROR_CODES.VALIDATION_ERROR,
				{ tagName: name, protected: true }
			);
		}

		// For API storage, we can't delete tags via CLI
		this.checkTagMutationSupport('Tag deletion');

		// Check if tag exists
		const allTags = await this.storage.getAllTags();
		if (!allTags.includes(name)) {
			throw new TaskMasterError(
				`Tag "${name}" does not exist`,
				ERROR_CODES.NOT_FOUND,
				{ tagName: name }
			);
		}

		// Delegate to storage
		await this.storage.deleteTag(name);
	}

	/**
	 * Rename an existing tag
	 * Cannot rename master tag
	 * For API storage: throws error (client should redirect to web UI)
	 */
	async renameTag(oldName: string, newName: string): Promise<void> {
		// Validate both names
		this.validateTagName(oldName, 'Old tag name');
		this.validateTagName(newName, 'New tag name');

		// Cannot rename master tag
		if (oldName === 'master') {
			throw new TaskMasterError(
				'Cannot rename the "master" tag',
				ERROR_CODES.VALIDATION_ERROR,
				{ tagName: oldName, protected: true }
			);
		}

		// For API storage, we can't rename tags via CLI
		this.checkTagMutationSupport('Tag renaming');

		// Check if old tag exists
		const allTags = await this.storage.getAllTags();
		if (!allTags.includes(oldName)) {
			throw new TaskMasterError(
				`Tag "${oldName}" does not exist`,
				ERROR_CODES.NOT_FOUND,
				{ tagName: oldName }
			);
		}

		// Check if new name already exists
		if (allTags.includes(newName)) {
			throw new TaskMasterError(
				`Tag "${newName}" already exists`,
				ERROR_CODES.VALIDATION_ERROR,
				{ tagName: newName }
			);
		}

		// Delegate to storage
		await this.storage.renameTag(oldName, newName);
	}

	/**
	 * Copy an existing tag to create a new tag with the same tasks
	 * For API storage: throws error (client should show alternative)
	 */
	async copyTag(
		sourceName: string,
		targetName: string,
		_options: CopyTagOptions = {}
	): Promise<void> {
		// Validate both names
		this.validateTagName(sourceName, 'Source tag name');
		this.validateTagName(targetName, 'Target tag name');

		// For API storage, we can't copy tags via CLI
		this.checkTagMutationSupport('Tag copying');

		// Check if source tag exists
		const allTags = await this.storage.getAllTags();
		if (!allTags.includes(sourceName)) {
			throw new TaskMasterError(
				`Source tag "${sourceName}" does not exist`,
				ERROR_CODES.NOT_FOUND,
				{ tagName: sourceName }
			);
		}

		// Check if target name already exists
		if (allTags.includes(targetName)) {
			throw new TaskMasterError(
				`Target tag "${targetName}" already exists`,
				ERROR_CODES.VALIDATION_ERROR,
				{ tagName: targetName }
			);
		}

		// Delegate to storage
		await this.storage.copyTag(sourceName, targetName);
	}

	/**
	 * Get all tags with statistics
	 * Works with both file and API storage
	 */
	async getTagsWithStats() {
		return await this.storage.getTagsWithStats();
	}
}
