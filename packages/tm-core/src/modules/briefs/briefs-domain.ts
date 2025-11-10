/**
 * @fileoverview Briefs Domain Facade
 * Public API for brief-related operations
 */

import { BriefService, type TagWithStats } from './services/brief-service.js';
import { AuthManager } from '../auth/managers/auth-manager.js';
import type { TaskRepository } from '../tasks/repositories/task-repository.interface.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../common/errors/task-master-error.js';

/**
 * Briefs Domain - Unified API for brief operations
 * Handles brief switching, matching, and statistics
 */
export class BriefsDomain {
	private briefService: BriefService;
	private authManager: AuthManager;

	constructor() {
		this.briefService = new BriefService();
		this.authManager = AuthManager.getInstance();
	}

	/**
	 * Switch to a different brief by name or ID
	 * Validates context, finds matching brief, and updates auth context
	 */
	async switchBrief(briefNameOrId: string): Promise<void> {
		const context = this.authManager.getContext();
		if (!context?.orgId) {
			throw new TaskMasterError(
				'No organization selected. Run "tm context org" first.',
				ERROR_CODES.CONFIG_ERROR
			);
		}

		// Fetch all briefs for the org (through auth manager)
		const briefs = await this.authManager.getBriefs(context.orgId);

		// Find matching brief
		const matchingBrief = await this.briefService.findBrief(
			briefs,
			briefNameOrId
		);

		this.briefService.validateBriefFound(matchingBrief, briefNameOrId);

		// Update context with the found brief
		await this.authManager.updateContext({
			briefId: matchingBrief.id,
			briefName:
				matchingBrief.document?.title || `Brief ${matchingBrief.id.slice(-8)}`
		});
	}

	/**
	 * Get all briefs with detailed statistics including task counts
	 * Used for API storage to show brief statistics
	 */
	async getBriefsWithStats(
		repository: TaskRepository,
		projectId: string
	): Promise<{
		tags: TagWithStats[];
		currentTag: string | null;
		totalTags: number;
	}> {
		const context = this.authManager.getContext();

		if (!context?.orgId) {
			throw new TaskMasterError(
				'No organization context available',
				ERROR_CODES.MISSING_CONFIGURATION,
				{
					operation: 'getBriefsWithStats',
					userMessage:
						'No organization selected. Please authenticate first using: tm auth login'
				}
			);
		}

		// Get all briefs for the organization (through auth manager)
		const briefs = await this.authManager.getBriefs(context.orgId);

		// Use BriefService to calculate stats
		return this.briefService.getTagsWithStats(
			briefs,
			context.briefId,
			repository,
			projectId
		);
	}
}
