/**
 * Authentication manager for Task Master CLI
 */

import {
	AuthCredentials,
	OAuthFlowOptions,
	AuthenticationError,
	AuthConfig,
	UserContext
} from './types.js';
import { CredentialStore } from './credential-store.js';
import { OAuthService } from './oauth-service.js';
import { SupabaseAuthClient } from '../clients/supabase-client.js';
import {
	OrganizationService,
	type Organization,
	type Brief,
	type RemoteTask
} from '../services/organization.service.js';
import { getLogger } from '../logger/index.js';

/**
 * Authentication manager class
 */
export class AuthManager {
	private static instance: AuthManager | null = null;
	private credentialStore: CredentialStore;
	private oauthService: OAuthService;
	private supabaseClient: SupabaseAuthClient;
	private organizationService?: OrganizationService;

	private constructor(config?: Partial<AuthConfig>) {
		this.credentialStore = new CredentialStore(config);
		this.supabaseClient = new SupabaseAuthClient();
		this.oauthService = new OAuthService(this.credentialStore, config);

		// Initialize Supabase client with session restoration
		this.initializeSupabaseSession();
	}

	/**
	 * Initialize Supabase session from stored credentials
	 */
	private async initializeSupabaseSession(): Promise<void> {
		try {
			await this.supabaseClient.initialize();
		} catch (error) {
			// Log but don't throw - session might not exist yet
			const logger = getLogger('AuthManager');
			logger.debug('No existing session to restore');
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
			const logger = getLogger('AuthManager');
			logger.warn(
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
	}

	/**
	 * Get stored authentication credentials
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

			// Get existing credentials to preserve context
			const existingCredentials = this.credentialStore.getCredentials({
				allowExpired: true
			});

			// Update authentication data from session
			const newAuthData: AuthCredentials = {
				token: session.access_token,
				refreshToken: session.refresh_token,
				userId: session.user.id,
				email: session.user.email,
				expiresAt: session.expires_at
					? new Date(session.expires_at * 1000).toISOString()
					: undefined,
				savedAt: new Date().toISOString(),
				selectedContext: existingCredentials?.selectedContext
			};

			this.credentialStore.saveCredentials(newAuthData);
			return newAuthData;
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
			getLogger('AuthManager').warn('Failed to sign out from Supabase:', error);
		}

		// Always clear local credentials (removes auth.json file)
		this.credentialStore.clearCredentials();
	}

	/**
	 * Check if authenticated
	 */
	isAuthenticated(): boolean {
		return this.credentialStore.hasValidCredentials();
	}

	/**
	 * Get the current user context (org/brief selection)
	 */
	getContext(): UserContext | null {
		const credentials = this.getCredentials();
		return credentials?.selectedContext || null;
	}

	/**
	 * Update the user context (org/brief selection)
	 */
	async updateContext(context: Partial<UserContext>): Promise<void> {
		const credentials = this.getCredentials();
		if (!credentials) {
			throw new AuthenticationError('Not authenticated', 'NOT_AUTHENTICATED');
		}

		// Merge with existing context
		const existingContext = credentials.selectedContext || {};
		const newContext: UserContext = {
			...existingContext,
			...context,
			updatedAt: new Date().toISOString()
		};

		// Save updated credentials with new context
		const updatedCredentials: AuthCredentials = {
			...credentials,
			selectedContext: newContext
		};

		this.credentialStore.saveCredentials(updatedCredentials);
	}

	/**
	 * Clear the user context
	 */
	async clearContext(): Promise<void> {
		const credentials = this.getCredentials();
		if (!credentials) {
			throw new AuthenticationError('Not authenticated', 'NOT_AUTHENTICATED');
		}

		// Remove context from credentials
		const { selectedContext, ...credentialsWithoutContext } = credentials;
		this.credentialStore.saveCredentials(credentialsWithoutContext);
	}

	/**
	 * Get the organization service instance
	 * Uses the Supabase client with the current session or token
	 */
	private async getOrganizationService(): Promise<OrganizationService> {
		if (!this.organizationService) {
			// First check if we have credentials with a token
			const credentials = this.getCredentials();
			if (!credentials || !credentials.token) {
				throw new AuthenticationError('Not authenticated', 'NOT_AUTHENTICATED');
			}

			// Initialize session if needed (this will load from our storage adapter)
			await this.supabaseClient.initialize();

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
