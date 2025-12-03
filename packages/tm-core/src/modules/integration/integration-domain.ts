/**
 * @fileoverview Integration Domain Facade
 * Public API for integration with external systems
 */

import { AuthManager } from '../auth/managers/auth-manager.js';
import type { ConfigManager } from '../config/managers/config-manager.js';
import { ExportService } from './services/export.service.js';
import type {
	BriefStatusResult,
	ExportResult,
	ExportTasksOptions,
	GenerateBriefFromPrdOptions,
	GenerateBriefFromPrdResult,
	GenerateBriefOptions,
	GenerateBriefResult,
	SendTeamInvitationsResult
} from './services/export.service.js';

/**
 * Integration Domain - Unified API for external system integration
 */
export class IntegrationDomain {
	private exportService: ExportService;

	constructor(configManager: ConfigManager) {
		// Get singleton AuthManager instance
		const authManager = AuthManager.getInstance();
		this.exportService = new ExportService(configManager, authManager);
	}

	// ========== Export Operations ==========

	/**
	 * Generate a new brief from local tasks
	 * This is the primary export method - creates a brief and imports all tasks atomically
	 *
	 * @param options - Options for generating the brief
	 * @returns Result with created brief details and task mapping
	 */
	async generateBriefFromTasks(
		options?: GenerateBriefOptions
	): Promise<GenerateBriefResult> {
		return this.exportService.generateBriefFromTasks(options);
	}

	/**
	 * Export tasks to an existing brief
	 * @deprecated Use generateBriefFromTasks instead - briefs are now created from tasks
	 */
	async exportTasks(options: ExportTasksOptions): Promise<ExportResult> {
		return this.exportService.exportTasks(options);
	}

	/**
	 * Generate a new brief from PRD content
	 * Sends PRD to Hamster which creates a brief and generates tasks asynchronously
	 *
	 * @param options - Options including the PRD content
	 * @returns Result with created brief details (tasks are generated async)
	 */
	async generateBriefFromPrd(
		options: GenerateBriefFromPrdOptions
	): Promise<GenerateBriefFromPrdResult> {
		return this.exportService.generateBriefFromPrd(options);
	}

	/**
	 * Get the current status of a brief's task generation
	 * Used to poll progress after generateBriefFromPrd
	 *
	 * @param briefId - The brief ID to check
	 * @returns Status result with progress details
	 */
	async getBriefStatus(briefId: string): Promise<BriefStatusResult> {
		return this.exportService.getBriefStatus(briefId);
	}

	/**
	 * Send team invitations to collaborate on Hamster
	 * This is called separately from brief creation
	 *
	 * @param accountSlug - The organization slug (from brief URL)
	 * @param emails - Array of email addresses to invite
	 * @param role - Role for invited users (default: 'member')
	 * @returns Result with invitation statuses
	 */
	async sendTeamInvitations(
		accountSlug: string,
		emails: string[],
		role: 'member' | 'admin' = 'member'
	): Promise<SendTeamInvitationsResult> {
		return this.exportService.sendTeamInvitations(accountSlug, emails, role);
	}
}
