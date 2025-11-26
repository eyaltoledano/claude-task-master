/**
 * Authentication manager for Task Master CLI
 * Lightweight coordinator that delegates to focused services
 */

import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import { getLogger } from '../../../common/logger/index.js';
import type { Brief } from '../../briefs/types.js';
import { SupabaseAuthClient } from '../../integration/clients/supabase-client.js';
import { ContextStore } from '../services/context-store.js';
import { OAuthService } from '../services/oauth-service.js';
import {
	type Organization,
	OrganizationService,
	type RemoteTask
} from '../services/organization.service.js';
import { SessionManager } from '../services/session-manager.js';
import {
	type AuthConfig,
	type AuthCredentials,
	AuthenticationError,
	type MFAVerificationResult,
	type OAuthFlowOptions,
	type UserContext,
	type UserContextWithBrief
} from '../types.js';

/**
 * Authentication manager class - coordinates auth services
 */
export class AuthManager {
	private static instance: AuthManager | null = null;
	private static readonly staticLogger = getLogger('AuthManager');
	private contextStore: ContextStore;
	private oauthService: OAuthService;
	private sessionManager: SessionManager;
	public supabaseClient: SupabaseAuthClient;
	private organizationService?: OrganizationService;

	private constructor(config?: Partial<AuthConfig>) {
		this.contextStore = ContextStore.getInstance();
		// Use singleton SupabaseAuthClient to prevent refresh token race conditions
		this.supabaseClient = SupabaseAuthClient.getInstance();

		// Initialize session manager (handles session lifecycle)
		this.sessionManager = new SessionManager(
			this.supabaseClient,
			this.contextStore
		);

		// Pass the supabase client to OAuthService so they share the same instance
		this.oauthService = new OAuthService(
			this.contextStore,
			this.supabaseClient,
			config
		);
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(config?: Partial<AuthConfig>): AuthManager {
		if (!AuthManager.instance) {
			AuthManager.instance = new AuthManager(config);
		} else if (config) {
			// Warn if config is provided after initialization
			AuthManager.staticLogger.warn(
				'getInstance called with config after initialization; config is ignored.'
			);
		}
		return AuthManager.instance;
	}

	/**
	 * Reset the singleton instance (useful for testing)
	 * Also resets SupabaseAuthClient to ensure clean state for test isolation
	 */
	static resetInstance(): void {
		AuthManager.instance = null;
		ContextStore.resetInstance();
		SupabaseAuthClient.resetInstance();
	}

	/**
	 * Get access token from current Supabase session
	 * @returns Access token or null if not authenticated
	 */
	async getAccessToken(): Promise<string | null> {
		return this.sessionManager.getAccessToken();
	}

	/**
	 * Get authentication credentials from Supabase session
	 * Modern replacement for legacy getCredentials()
	 * @returns AuthCredentials object or null if not authenticated
	 */
	async getAuthCredentials(): Promise<AuthCredentials | null> {
		return this.sessionManager.getAuthCredentials();
	}

	/**
	 * Start OAuth 2.0 Authorization Code Flow with browser handling
	 */
	async authenticateWithOAuth(
		options: OAuthFlowOptions = {}
	): Promise<AuthCredentials> {
		return this.oauthService.authenticate(options);
	}

	/**
	 * Authenticate using a one-time token
	 * This is useful for CLI authentication in SSH/remote environments
	 * where browser-based auth is not practical
	 */
	async authenticateWithCode(token: string): Promise<AuthCredentials> {
		return this.sessionManager.authenticateWithCode(token);
	}

	/**
	 * Verify MFA code and complete authentication
	 * Call this after authenticateWithCode() throws MFA_REQUIRED error
	 */
	async verifyMFA(factorId: string, code: string): Promise<AuthCredentials> {
		return this.sessionManager.verifyMFA(factorId, code);
	}

	/**
	 * Verify MFA code with automatic retry logic
	 * Handles retry attempts for invalid MFA codes up to maxAttempts
	 *
	 * @param factorId - MFA factor ID from the MFA_REQUIRED error
	 * @param codeProvider - Function that prompts for and returns the MFA code
	 * @param options - Optional configuration for retry behavior
	 * @returns Result object with success status, attempts used, and credentials if successful
	 *
	 * @example
	 * ```typescript
	 * const result = await authManager.verifyMFAWithRetry(
	 *   factorId,
	 *   async () => await promptUserForMFACode(),
	 *   {
	 *     maxAttempts: 3,
	 *     onInvalidCode: (attempt, remaining) => console.log(`Invalid code. ${remaining} attempts remaining.`)
	 *   }
	 * );
	 *
	 * if (result.success) {
	 *   console.log('MFA verified!', result.credentials);
	 * } else {
	 *   console.error(`Failed after ${result.attemptsUsed} attempts`);
	 * }
	 * ```
	 */
	async verifyMFAWithRetry(
		factorId: string,
		codeProvider: () => Promise<string>,
		options?: {
			maxAttempts?: number;
			onInvalidCode?: (attempt: number, remaining: number) => void;
		}
	): Promise<MFAVerificationResult> {
		const maxAttempts = options?.maxAttempts ?? 3;
		const onInvalidCode = options?.onInvalidCode;

		// Guard against invalid maxAttempts values
		if (
			!Number.isFinite(maxAttempts) ||
			!Number.isInteger(maxAttempts) ||
			maxAttempts < 1
		) {
			throw new TypeError(
				`Invalid maxAttempts value: ${maxAttempts}. Must be a positive integer.`
			);
		}

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const code = await codeProvider();
				const credentials = await this.verifyMFA(factorId, code);
				return {
					success: true,
					attemptsUsed: attempt,
					credentials
				};
			} catch (error) {
				// Only retry on invalid MFA code errors
				if (
					error instanceof AuthenticationError &&
					error.code === 'INVALID_MFA_CODE'
				) {
					// Calculate remaining attempts
					const remaining = maxAttempts - attempt;

					// Notify callback of invalid code
					if (onInvalidCode) {
						onInvalidCode(attempt, remaining);
					}

					// If we've exhausted attempts, return failure
					if (attempt >= maxAttempts) {
						return {
							success: false,
							attemptsUsed: attempt,
							errorCode: 'INVALID_MFA_CODE'
						};
					}
					// Otherwise continue to next attempt
					continue;
				}

				// For other errors, fail immediately
				throw error;
			}
		}

		// Should never reach here due to loop logic, but TypeScript needs it
		return {
			success: false,
			attemptsUsed: maxAttempts,
			errorCode: 'MFA_VERIFICATION_FAILED'
		};
	}

	/**
	 * Get the authorization URL (for browser opening)
	 */
	getAuthorizationUrl(): string | null {
		return this.oauthService.getAuthorizationUrl();
	}

	/**
	 * Refresh authentication token using Supabase session
	 * Note: Supabase handles token refresh automatically via the session storage adapter.
	 * This method is mainly for explicit refresh requests.
	 */
	async refreshToken(): Promise<AuthCredentials> {
		return this.sessionManager.refreshToken();
	}

	/**
	 * Logout and clear credentials
	 */
	async logout(): Promise<void> {
		return this.sessionManager.logout();
	}

	/**
	 * Check if valid Supabase session exists
	 * @returns true if a valid session exists
	 */
	async hasValidSession(): Promise<boolean> {
		return this.sessionManager.hasValidSession();
	}

	/**
	 * Get the current Supabase session
	 */
	async getSession() {
		return this.sessionManager.getSession();
	}

	/**
	 * Get stored user context (userId, email)
	 */
	getStoredContext() {
		return this.sessionManager.getStoredContext();
	}

	/**
	 * Get the current user context (org/brief selection)
	 */
	getContext(): UserContext | null {
		return this.contextStore.getUserContext();
	}

	/**
	 * Update the user context (org/brief selection)
	 */
	async updateContext(context: Partial<UserContext>): Promise<void> {
		if (!(await this.hasValidSession())) {
			throw new AuthenticationError('Not authenticated', 'NOT_AUTHENTICATED');
		}

		this.contextStore.updateUserContext(context);
	}

	/**
	 * Clear the user context
	 */
	async clearContext(): Promise<void> {
		if (!(await this.hasValidSession())) {
			throw new AuthenticationError('Not authenticated', 'NOT_AUTHENTICATED');
		}

		this.contextStore.clearUserContext();
	}

	/**
	 * Get the organization service instance
	 * Uses the Supabase client with the current session
	 */
	private async getOrganizationService(): Promise<OrganizationService> {
		if (!this.organizationService) {
			// Check if we have a valid Supabase session via SessionManager
			const session = await this.sessionManager.getSession();

			if (!session) {
				throw new AuthenticationError('Not authenticated', 'NOT_AUTHENTICATED');
			}

			// Use the SupabaseAuthClient which now has the session
			const supabaseClient = this.supabaseClient.getClient();
			this.organizationService = new OrganizationService(supabaseClient as any);
		}
		return this.organizationService;
	}

	/**
	 * Get all organizations for the authenticated user
	 */
	async getOrganizations(): Promise<Organization[]> {
		const service = await this.getOrganizationService();
		return service.getOrganizations();
	}

	/**
	 * Get all briefs for a specific organization
	 */
	async getBriefs(orgId: string): Promise<Brief[]> {
		const service = await this.getOrganizationService();
		return service.getBriefs(orgId);
	}

	/**
	 * Get a specific organization by ID
	 */
	async getOrganization(orgId: string): Promise<Organization | null> {
		const service = await this.getOrganizationService();
		return service.getOrganization(orgId);
	}

	/**
	 * Get a specific brief by ID
	 */
	async getBrief(briefId: string): Promise<Brief | null> {
		const service = await this.getOrganizationService();
		return service.getBrief(briefId);
	}

	/**
	 * Get all tasks for a specific brief
	 */
	async getTasks(briefId: string): Promise<RemoteTask[]> {
		const service = await this.getOrganizationService();
		return service.getTasks(briefId);
	}

	/**
	 * Ensure a brief is selected in the current context
	 * Throws a TaskMasterError if no brief is selected
	 * @param operation - The operation name for error context
	 * @returns The current user context with a guaranteed briefId
	 */
	ensureBriefSelected(operation: string): UserContextWithBrief {
		const context = this.getContext();

		if (!context?.briefId) {
			throw new TaskMasterError(
				'No brief selected',
				ERROR_CODES.NO_BRIEF_SELECTED,
				{
					operation,
					userMessage:
						'No brief selected. Please select a brief first using: tm context brief <brief-id> or tm context brief <brief-url>'
				}
			);
		}

		return context as UserContextWithBrief;
	}
}
