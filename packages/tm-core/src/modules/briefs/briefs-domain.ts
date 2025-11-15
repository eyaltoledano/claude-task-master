/**
 * @fileoverview Briefs Domain Facade
 * Public API for brief-related operations
 */

import {
	ERROR_CODES,
	TaskMasterError
} from '../../common/errors/task-master-error.js';
import { AuthManager } from '../auth/managers/auth-manager.js';
import type { TaskRepository } from '../tasks/repositories/task-repository.interface.js';
import { BriefService, type TagWithStats } from './services/brief-service.js';
import { BriefUrlParser } from './utils/url-parser.js';

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
	 * Resolve a brief by name, ID, URL, or partial ID without updating context
	 * Returns the full brief object
	 *
	 * Supports:
	 * - Hamster URLs (e.g., https://app.tryhamster.com/home/hamster/briefs/abc123)
	 * - Full UUID
	 * - Last 8 characters of UUID
	 * - Brief name (exact or partial match)
	 *
	 * @param input - Raw input: URL, UUID, last 8 chars, or brief name
	 * @param orgId - Optional organization ID. If not provided, tries to extract from URL or uses current context.
	 * @returns The resolved brief object
	 */
	async resolveBrief(input: string, orgId?: string): Promise<any> {
		// Parse input using dedicated URL parser
		const parsed = BriefUrlParser.parse(input);
		const briefIdOrName = parsed.briefId || input.trim();

		// Resolve organization ID (priority: parameter > URL > context)
		let resolvedOrgId = orgId;

		// Try to extract org slug from URL if not provided
		if (!resolvedOrgId && parsed.orgSlug) {
			try {
				const orgs = await this.authManager.getOrganizations();
				const matchingOrg = orgs.find(
					(org) =>
						org.slug?.toLowerCase() === parsed.orgSlug?.toLowerCase() ||
						org.name.toLowerCase() === parsed.orgSlug?.toLowerCase()
				);
				if (matchingOrg) {
					resolvedOrgId = matchingOrg.id;
				}
			} catch {
				// If we can't fetch orgs, fall through to context
			}
		}

		// Fall back to context if still not resolved
		if (!resolvedOrgId) {
			resolvedOrgId = this.authManager.getContext()?.orgId;
		}

		if (!resolvedOrgId) {
			throw new TaskMasterError(
				'No organization selected. Run "tm context org" first.',
				ERROR_CODES.CONFIG_ERROR
			);
		}

		// Fetch all briefs for the org
		const briefs = await this.authManager.getBriefs(resolvedOrgId);

		// Find matching brief using service
		const matchingBrief = await this.briefService.findBrief(
			briefs,
			briefIdOrName
		);

		this.briefService.validateBriefFound(matchingBrief, briefIdOrName);

		return matchingBrief;
	}

	/**
	 * Switch to a different brief by name or ID
	 * Validates context, finds matching brief, and updates auth context
	 */
	async switchBrief(briefNameOrId: string): Promise<void> {
		// Use resolveBrief to find the brief
		const matchingBrief = await this.resolveBrief(briefNameOrId);

		// Update context with the found brief
		await this.authManager.updateContext({
			briefId: matchingBrief.id,
			briefName:
				matchingBrief.document?.title || `Brief ${matchingBrief.id.slice(-8)}`,
			briefStatus: matchingBrief.status,
			briefUpdatedAt: matchingBrief.updatedAt
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
