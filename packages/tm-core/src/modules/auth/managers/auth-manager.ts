/**
 * Authentication manager for Task Master CLI
 */

import {
	AuthCredentials,
	OAuthFlowOptions,
	AuthenticationError,
	AuthConfig,
	UserContext
} from '../types.js';
import { CredentialStore } from '../services/credential-store.js';
import { ContextStore } from '../services/context-store.js';
import { OAuthService } from '../services/oauth-service.js';
import { SupabaseAuthClient } from '../../integration/clients/supabase-client.js';
import {
	OrganizationService,
	type Organization,
	type Brief,
	type RemoteTask
} from '../services/organization.service.js';
import { getLogger } from '../../../common/logger/index.js';

/**
 * Authentication manager class
 */
export class AuthManager {
	private static instance: AuthManager | null = null;
	private static readonly staticLogger = getLogger('AuthManager');
	private credentialStore: CredentialStore;
	private contextStore: ContextStore;
	private oauthService: OAuthService;
	public supabaseClient: SupabaseAuthClient;
	private organizationService?: OrganizationService;
	private readonly logger = getLogger('AuthManager');

	private constructor(config?: Partial<AuthConfig>) {
		this.credentialStore = CredentialStore.getInstance(config);
		this.contextStore = ContextStore.getInstance();
		this.supabaseClient = new SupabaseAuthClient();
		// Pass the supabase client to OAuthService so they share the same instance
		this.oauthService = new OAuthService(
			this.contextStore,
			this.supabaseClient,
			config
		);

		// Initialize Supabase client with session restoration
		// Fire-and-forget with catch handler to prevent unhandled rejections
		this.initializeSupabaseSession().catch(() => {
			// Errors are already logged in initializeSupabaseSession
		});
	}

	/**
	 * Initialize Supabase session from stored credentials
	 */
	private async initializeSupabaseSession(): Promise<void> {
		try {
			await this.supabaseClient.initialize();
		} catch (error) {
			// Log but don't throw - session might not exist yet
			this.logger.debug('No existing session to restore');
		}
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
	 */
	static resetInstance(): void {
		AuthManager.instance = null;
		CredentialStore.resetInstance();
		ContextStore.resetInstance();
	}

	/**
	 * Get stored authentication credentials
	 * Returns credentials as-is (even if expired). Refresh must be triggered explicitly
	 * via refreshToken() or will occur automatically when using the Supabase client for API calls.
	 */
	getCredentials(): AuthCredentials | null {
		return this.credentialStore.getCredentials();
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
		try {
			// Use Supabase's built-in session refresh
			const session = await this.supabaseClient.refreshSession();

			if (!session) {
				throw new AuthenticationError(
					'Failed to refresh session',
					'REFRESH_FAILED'
				);
			}

			// Sync user info to context store
			this.contextStore.saveContext({
				userId: session.user.id,
				email: session.user.email
			});

			// Build credentials response
			const context = this.contextStore.getContext();
			const credentials: AuthCredentials = {
				token: session.access_token,
				refreshToken: session.refresh_token,
				userId: session.user.id,
				email: session.user.email,
				expiresAt: session.expires_at
					? new Date(session.expires_at * 1000).toISOString()
					: undefined,
				savedAt: new Date().toISOString(),
				selectedContext: context?.selectedContext
			};

			return credentials;
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}
			throw new AuthenticationError(
				`Token refresh failed: ${(error as Error).message}`,
				'REFRESH_FAILED'
			);
		}
	}

	/**
	 * Logout and clear credentials
	 */
	async logout(): Promise<void> {
		try {
			// First try to sign out from Supabase to revoke tokens
			await this.supabaseClient.signOut();
		} catch (error) {
			// Log but don't throw - we still want to clear local credentials
			this.logger.warn('Failed to sign out from Supabase:', error);
		}

		// Clear all auth data
		this.credentialStore.clearCredentials(); // Legacy store
		this.contextStore.clearContext(); // App context
		// Session is cleared by supabaseClient.signOut()
	}

	/**
	 * Check if valid Supabase session exists
	 * @returns true if a valid session exists
	 */
	async hasValidSession(): Promise<boolean> {
		try {
			const session = await this.supabaseClient.getSession();
			return session !== null;
		} catch {
			return false;
		}
	}

	/**
	 * Get the current Supabase session
	 */
	async getSession() {
		return this.supabaseClient.getSession();
	}

	/**
	 * Get stored user context (userId, email)
	 */
	getStoredContext() {
		return this.contextStore.getContext();
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
	updateContext(context: Partial<UserContext>): void {
		if (!this.hasValidSession()) {
			throw new AuthenticationError('Not authenticated', 'NOT_AUTHENTICATED');
		}

		this.contextStore.updateUserContext(context);
	}

	/**
	 * Clear the user context
	 */
	clearContext(): void {
		if (!this.hasValidSession()) {
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
			// Check if we have a valid Supabase session
			const session = await this.supabaseClient.getSession();

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
}
