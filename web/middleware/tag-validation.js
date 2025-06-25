/**
 * Task Master Web Server Tag Validation & Context Management Middleware
 *
 * Implements comprehensive tag validation, context consistency checks, and atomic tag operations
 * to ensure reliable tag-based task management across all API endpoints.
 */

import fs from 'fs';
import path from 'path';
import { getCurrentTag } from '../../scripts/modules/utils.js';
import { getTaskMasterDirectory } from '../utils.js';

// Tag validation configuration
const TAG_CONFIG = {
	validation: {
		namePattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/, // Alphanumeric, hyphens, underscores
		maxNameLength: 50,
		reservedNames: ['', 'undefined', 'null', 'true', 'false'],
		requiredFields: ['tasks', 'metadata']
	},
	recovery: {
		createMissingTags: true,
		repairCorruptedTags: true,
		backupBeforeRepair: true,
		maxRecoveryAttempts: 3
	},
	atomicity: {
		lockTimeout: 30000, // 30 seconds
		operationTimeout: 60000, // 1 minute
		retryDelay: 1000 // 1 second
	}
};

// Tag operation lock manager
class TagLockManager {
	constructor() {
		this.locks = new Map(); // tag -> { lockId, timestamp, operation }
		this.operationQueue = new Map(); // tag -> [operations]
	}

	/**
	 * Acquire a lock for tag operations
	 */
	async acquireLock(
		tag,
		operation,
		timeout = TAG_CONFIG.atomicity.lockTimeout
	) {
		const lockId = `lock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

		return new Promise((resolve, reject) => {
			const tryAcquire = () => {
				if (!this.locks.has(tag)) {
					// Lock is available
					this.locks.set(tag, {
						lockId,
						timestamp: Date.now(),
						operation
					});
					resolve(lockId);
					return;
				}

				// Check if existing lock has expired
				const existingLock = this.locks.get(tag);
				if (Date.now() - existingLock.timestamp > timeout) {
					console.warn(`⚠️ Tag lock for '${tag}' expired, forcibly releasing`);
					this.releaseLock(tag, existingLock.lockId);
					this.locks.set(tag, {
						lockId,
						timestamp: Date.now(),
						operation
					});
					resolve(lockId);
					return;
				}

				// Lock is held, try again after delay
				setTimeout(tryAcquire, TAG_CONFIG.atomicity.retryDelay);
			};

			// Set timeout for lock acquisition
			const timeoutId = setTimeout(() => {
				reject(
					new Error(
						`Failed to acquire lock for tag '${tag}' within ${timeout}ms`
					)
				);
			}, timeout);

			tryAcquire();

			// Clear timeout on successful acquisition
			const originalResolve = resolve;
			resolve = (value) => {
				clearTimeout(timeoutId);
				originalResolve(value);
			};
		});
	}

	/**
	 * Release a tag operation lock
	 */
	releaseLock(tag, lockId) {
		const lock = this.locks.get(tag);
		if (lock && lock.lockId === lockId) {
			this.locks.delete(tag);
			return true;
		}
		return false;
	}

	/**
	 * Check if tag is locked
	 */
	isLocked(tag) {
		return this.locks.has(tag);
	}

	/**
	 * Get lock info for tag
	 */
	getLockInfo(tag) {
		return this.locks.get(tag) || null;
	}

	/**
	 * Get all active locks
	 */
	getAllLocks() {
		return Object.fromEntries(this.locks.entries());
	}
}

// Global tag lock manager
const tagLockManager = new TagLockManager();

class TagValidator {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
		this.tasksFilePath = path.join(
			getTaskMasterDirectory(projectRoot),
			'tasks',
			'tasks.json'
		);
		this.stateFilePath = path.join(
			getTaskMasterDirectory(projectRoot),
			'state.json'
		);
	}

	/**
	 * Validate tag name format
	 */
	validateTagName(tagName) {
		const issues = [];

		if (!tagName || typeof tagName !== 'string') {
			issues.push('Tag name must be a non-empty string');
			return { valid: false, issues };
		}

		if (tagName.length > TAG_CONFIG.validation.maxNameLength) {
			issues.push(
				`Tag name cannot exceed ${TAG_CONFIG.validation.maxNameLength} characters`
			);
		}

		if (TAG_CONFIG.validation.reservedNames.includes(tagName.toLowerCase())) {
			issues.push(`'${tagName}' is a reserved tag name`);
		}

		if (!TAG_CONFIG.validation.namePattern.test(tagName)) {
			issues.push(
				'Tag name can only contain alphanumeric characters, hyphens, and underscores'
			);
		}

		return {
			valid: issues.length === 0,
			issues
		};
	}

	/**
	 * Validate tag structure
	 */
	validateTagStructure(tagData, tagName) {
		const issues = [];

		if (!tagData || typeof tagData !== 'object') {
			issues.push(`Tag '${tagName}' data must be an object`);
			return { valid: false, issues };
		}

		// Check required fields
		TAG_CONFIG.validation.requiredFields.forEach((field) => {
			if (!(field in tagData)) {
				issues.push(`Tag '${tagName}' is missing required field: ${field}`);
			}
		});

		// Validate tasks array
		if (tagData.tasks && !Array.isArray(tagData.tasks)) {
			issues.push(`Tag '${tagName}' tasks field must be an array`);
		}

		// Validate metadata
		if (tagData.metadata && typeof tagData.metadata !== 'object') {
			issues.push(`Tag '${tagName}' metadata field must be an object`);
		}

		return {
			valid: issues.length === 0,
			issues
		};
	}

	/**
	 * Load and validate tasks file
	 */
	async loadTasksFile() {
		try {
			if (!fs.existsSync(this.tasksFilePath)) {
				return {
					valid: false,
					error: 'Tasks file does not exist',
					data: null
				};
			}

			const tasksContent = await fs.promises.readFile(
				this.tasksFilePath,
				'utf8'
			);

			if (!tasksContent.trim()) {
				return {
					valid: false,
					error: 'Tasks file is empty',
					data: null
				};
			}

			const tasksData = JSON.parse(tasksContent);

			return {
				valid: true,
				error: null,
				data: tasksData
			};
		} catch (error) {
			return {
				valid: false,
				error: `Failed to load tasks file: ${error.message}`,
				data: null
			};
		}
	}

	/**
	 * Validate tag existence and structure
	 */
	async validateTag(tagName) {
		// Validate tag name
		const nameValidation = this.validateTagName(tagName);
		if (!nameValidation.valid) {
			return {
				valid: false,
				exists: false,
				issues: nameValidation.issues,
				canRecover: false
			};
		}

		// Load tasks file
		const tasksFileResult = await this.loadTasksFile();
		if (!tasksFileResult.valid) {
			return {
				valid: false,
				exists: false,
				issues: [tasksFileResult.error],
				canRecover: true,
				recoveryAction: 'recreate_tasks_file'
			};
		}

		const tasksData = tasksFileResult.data;

		// Check if tag exists
		if (!(tagName in tasksData)) {
			return {
				valid: false,
				exists: false,
				issues: [`Tag '${tagName}' does not exist`],
				canRecover: TAG_CONFIG.recovery.createMissingTags,
				recoveryAction: 'create_missing_tag'
			};
		}

		// Validate tag structure
		const structureValidation = this.validateTagStructure(
			tasksData[tagName],
			tagName
		);

		return {
			valid: structureValidation.valid,
			exists: true,
			issues: structureValidation.issues,
			canRecover:
				!structureValidation.valid && TAG_CONFIG.recovery.repairCorruptedTags,
			recoveryAction: structureValidation.valid ? null : 'repair_tag_structure'
		};
	}

	/**
	 * Recover tag issues
	 */
	async recoverTag(tagName, recoveryAction) {
		const lockId = await tagLockManager.acquireLock(
			tagName,
			`recover_${recoveryAction}`
		);

		try {
			console.log(
				`🔧 Attempting tag recovery for '${tagName}' (${recoveryAction})`
			);

			switch (recoveryAction) {
				case 'recreate_tasks_file':
					return await this.recreateTasksFile();

				case 'create_missing_tag':
					return await this.createMissingTag(tagName);

				case 'repair_tag_structure':
					return await this.repairTagStructure(tagName);

				default:
					throw new Error(`Unknown recovery action: ${recoveryAction}`);
			}
		} finally {
			tagLockManager.releaseLock(tagName, lockId);
		}
	}

	/**
	 * Recreate tasks file
	 */
	async recreateTasksFile() {
		// Create backup if file exists but is corrupted
		if (fs.existsSync(this.tasksFilePath)) {
			const backupPath = `${this.tasksFilePath}.backup.${Date.now()}`;
			await fs.promises.copyFile(this.tasksFilePath, backupPath);
			console.log(`📦 Created backup: ${backupPath}`);
		}

		// Create new tasks file with master tag
		const newTasksData = {
			master: {
				tasks: [],
				metadata: {
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					description: 'Tasks for master context'
				}
			}
		};

		await fs.promises.writeFile(
			this.tasksFilePath,
			JSON.stringify(newTasksData, null, 2)
		);
		console.log('✅ Tasks file recreated successfully');

		return { success: true, action: 'recreated_tasks_file' };
	}

	/**
	 * Create missing tag
	 */
	async createMissingTag(tagName) {
		const tasksFileResult = await this.loadTasksFile();
		if (!tasksFileResult.valid) {
			throw new Error('Cannot create tag: tasks file is invalid');
		}

		const tasksData = tasksFileResult.data;

		// Create new tag structure
		tasksData[tagName] = {
			tasks: [],
			metadata: {
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				description: `Tasks for ${tagName} context`
			}
		};

		// Write back to file
		await fs.promises.writeFile(
			this.tasksFilePath,
			JSON.stringify(tasksData, null, 2)
		);
		console.log(`✅ Created missing tag '${tagName}'`);

		return { success: true, action: 'created_missing_tag', tagName };
	}

	/**
	 * Repair tag structure
	 */
	async repairTagStructure(tagName) {
		const tasksFileResult = await this.loadTasksFile();
		if (!tasksFileResult.valid) {
			throw new Error('Cannot repair tag: tasks file is invalid');
		}

		const tasksData = tasksFileResult.data;
		const tagData = tasksData[tagName];

		// Backup original if configured
		if (TAG_CONFIG.recovery.backupBeforeRepair) {
			const backupPath = `${this.tasksFilePath}.backup.${Date.now()}`;
			await fs.promises.copyFile(this.tasksFilePath, backupPath);
			console.log(`📦 Created backup before repair: ${backupPath}`);
		}

		// Repair missing or invalid fields
		if (!Array.isArray(tagData.tasks)) {
			tagData.tasks = [];
		}

		if (!tagData.metadata || typeof tagData.metadata !== 'object') {
			tagData.metadata = {
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				description: `Repaired ${tagName} context`
			};
		}

		// Ensure metadata has required fields
		if (!tagData.metadata.created) {
			tagData.metadata.created = new Date().toISOString();
		}
		if (!tagData.metadata.updated) {
			tagData.metadata.updated = new Date().toISOString();
		}

		// Write repaired data back
		await fs.promises.writeFile(
			this.tasksFilePath,
			JSON.stringify(tasksData, null, 2)
		);
		console.log(`✅ Repaired tag structure for '${tagName}'`);

		return { success: true, action: 'repaired_tag_structure', tagName };
	}

	/**
	 * Get current tag with validation
	 */
	async getCurrentTagWithValidation() {
		try {
			const currentTag = getCurrentTag(this.projectRoot);
			const validation = await this.validateTag(currentTag);

			return {
				tag: currentTag,
				validation
			};
		} catch (error) {
			return {
				tag: null,
				validation: {
					valid: false,
					exists: false,
					issues: [`Failed to get current tag: ${error.message}`],
					canRecover: false
				}
			};
		}
	}

	/**
	 * Validate and get all tags
	 */
	async validateAllTags() {
		const tasksFileResult = await this.loadTasksFile();
		if (!tasksFileResult.valid) {
			return {
				valid: false,
				error: tasksFileResult.error,
				tags: {}
			};
		}

		const tasksData = tasksFileResult.data;
		const tagValidations = {};

		for (const [tagName, tagData] of Object.entries(tasksData)) {
			const nameValidation = this.validateTagName(tagName);
			const structureValidation = this.validateTagStructure(tagData, tagName);

			tagValidations[tagName] = {
				nameValid: nameValidation.valid,
				structureValid: structureValidation.valid,
				issues: [...nameValidation.issues, ...structureValidation.issues],
				canRecover:
					!structureValidation.valid && TAG_CONFIG.recovery.repairCorruptedTags
			};
		}

		const allValid = Object.values(tagValidations).every(
			(v) => v.nameValid && v.structureValid
		);

		return {
			valid: allValid,
			error: null,
			tags: tagValidations
		};
	}
}

/**
 * Enhanced tag resolution middleware with validation and recovery
 */
export function tagValidationMiddleware() {
	return async (req, res, next) => {
		const projectRoot = req.projectRoot || req.app.get('projectRoot');
		if (!projectRoot) {
			return res.status(500).json({
				error: 'Internal Server Error',
				message: 'Project root not configured'
			});
		}

		const validator = new TagValidator(projectRoot);

		try {
			// Get tag from various sources
			const explicitTag = req.query.tag || req.body?.tag || req.params.tag;
			let effectiveTag;
			let tagSource;

			if (explicitTag) {
				// Validate explicit tag
				const validation = await validator.validateTag(explicitTag);

				if (!validation.valid && validation.canRecover) {
					console.log(`🔧 Auto-recovering tag '${explicitTag}'`);
					await validator.recoverTag(explicitTag, validation.recoveryAction);

					// Re-validate after recovery
					const revalidation = await validator.validateTag(explicitTag);
					if (!revalidation.valid) {
						return res.status(400).json({
							error: 'Tag Validation Error',
							message: `Tag '${explicitTag}' is invalid and could not be recovered`,
							issues: revalidation.issues
						});
					}
				} else if (!validation.valid) {
					return res.status(400).json({
						error: 'Tag Validation Error',
						message: `Tag '${explicitTag}' is invalid`,
						issues: validation.issues
					});
				}

				effectiveTag = explicitTag;
				tagSource = 'explicit';
			} else {
				// Use current tag with validation
				const currentTagResult = await validator.getCurrentTagWithValidation();

				if (
					!currentTagResult.validation.valid &&
					currentTagResult.validation.canRecover
				) {
					console.log(
						`🔧 Auto-recovering current tag '${currentTagResult.tag}'`
					);
					await validator.recoverTag(
						currentTagResult.tag,
						currentTagResult.validation.recoveryAction
					);
					effectiveTag = currentTagResult.tag;
					tagSource = 'recovered';
				} else if (!currentTagResult.validation.valid) {
					// Fall back to master tag
					console.warn(
						`⚠️ Current tag invalid, falling back to master: ${currentTagResult.validation.issues.join(', ')}`
					);
					effectiveTag = 'master';
					tagSource = 'fallback';
				} else {
					effectiveTag = currentTagResult.tag;
					tagSource = 'current';
				}
			}

			// Final validation of effective tag
			if (effectiveTag !== 'master') {
				const finalValidation = await validator.validateTag(effectiveTag);
				if (!finalValidation.valid) {
					console.warn(
						`⚠️ Effective tag '${effectiveTag}' invalid, falling back to master`
					);
					effectiveTag = 'master';
					tagSource = 'fallback';
				}
			}

			// Attach validated tag information to request
			req.effectiveTag = effectiveTag;
			req.explicitTag = explicitTag || null;
			req.tagSource = tagSource;
			req.tagValidator = validator;

			// Add tag operation helpers
			req.withTagLock = async (operation, operationFunc) => {
				const lockId = await tagLockManager.acquireLock(
					effectiveTag,
					operation
				);
				try {
					return await operationFunc();
				} finally {
					tagLockManager.releaseLock(effectiveTag, lockId);
				}
			};

			next();
		} catch (error) {
			console.error('❌ Tag validation middleware error:', error);
			res.status(500).json({
				error: 'Tag Validation Error',
				message: 'Failed to validate tag context',
				details: error.message
			});
		}
	};
}

/**
 * Middleware to ensure tag exists before operations
 */
export function ensureTagExists() {
	return async (req, res, next) => {
		const { effectiveTag, tagValidator } = req;

		if (!tagValidator) {
			return res.status(500).json({
				error: 'Internal Server Error',
				message: 'Tag validator not initialized'
			});
		}

		try {
			const validation = await tagValidator.validateTag(effectiveTag);

			if (!validation.exists) {
				if (validation.canRecover) {
					console.log(
						`🔧 Creating missing tag '${effectiveTag}' for operation`
					);
					await tagValidator.recoverTag(
						effectiveTag,
						validation.recoveryAction
					);
				} else {
					return res.status(404).json({
						error: 'Tag Not Found',
						message: `Tag '${effectiveTag}' does not exist and cannot be created`,
						tag: effectiveTag
					});
				}
			}

			next();
		} catch (error) {
			console.error('❌ Ensure tag exists error:', error);
			res.status(500).json({
				error: 'Tag Validation Error',
				message: 'Failed to ensure tag exists',
				details: error.message
			});
		}
	};
}

/**
 * Get tag lock manager status
 */
export function getTagLockStatus() {
	return {
		activeLocks: tagLockManager.getAllLocks(),
		lockCount: tagLockManager.locks.size
	};
}

/**
 * Force release a tag lock (administrative function)
 */
export function forceReleaseTagLock(tag) {
	const lockInfo = tagLockManager.getLockInfo(tag);
	if (lockInfo) {
		tagLockManager.releaseLock(tag, lockInfo.lockId);
		return true;
	}
	return false;
}

/**
 * Validate tag operation payload
 */
export function validateTagOperation(operationType) {
	return (req, res, next) => {
		// Determine which tag to check for locks based on the operation
		let tagToCheck;

		switch (operationType) {
			case 'delete':
			case 'rename':
				// For delete/rename operations, check the tag being operated on
				tagToCheck = req.validatedParams?.tagName || req.params?.tagName;
				break;
			case 'copy':
				// For copy operations, check the source tag
				tagToCheck = req.validatedParams?.sourceName || req.params?.sourceName;
				break;
			case 'create':
			default:
				// For create operations, no lock check needed (creating new tag)
				// For other operations, use effective tag
				tagToCheck = req.effectiveTag;
				break;
		}

		// Skip lock check for create operations or if no tag to check
		if (operationType === 'create' || !tagToCheck) {
			return next();
		}

		// Check if tag is locked by another operation
		if (tagLockManager.isLocked(tagToCheck)) {
			const lockInfo = tagLockManager.getLockInfo(tagToCheck);
			return res.status(423).json({
				error: 'Tag Locked',
				message: `Tag '${tagToCheck}' is currently locked by another operation`,
				lockInfo: {
					operation: lockInfo.operation,
					since: new Date(lockInfo.timestamp).toISOString()
				}
			});
		}

		next();
	};
}

export { TagValidator, tagLockManager, TAG_CONFIG };
