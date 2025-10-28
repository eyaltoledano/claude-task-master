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
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Authentication manager class
 */
export class AuthManager {
	private static instance: AuthManager | null = null;
	private static readonly staticLogger = getLogger('AuthManager');
	private contextStore: ContextStore;
	private oauthService: OAuthService;
	public supabaseClient: SupabaseAuthClient;
	private organizationService?: OrganizationService;
	private readonly logger = getLogger('AuthManager');
	private readonly LEGACY_AUTH_FILE = path.join(
		os.homedir(),
		'.taskmaster',
		'auth.json'
	);

	private constructor(config?: Partial<AuthConfig>) {
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

		// Migrate legacy auth.json if it exists
		// Fire-and-forget with catch handler
		this.migrateLegacyAuth().catch(() => {
			// Errors are already logged in migrateLegacyAuth
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
	 * Migrate legacy auth.json to Supabase session
	 * Called once during AuthManager initialization
	 */
	private async migrateLegacyAuth(): Promise<void> {
		if (!fs.existsSync(this.LEGACY_AUTH_FILE)) {
			return;
		}

		try {
			// If we have a valid Supabase session, delete legacy file
			const hasSession = await this.hasValidSession();
			if (hasSession) {
				fs.unlinkSync(this.LEGACY_AUTH_FILE);
				this.logger.info('Migrated to Supabase auth, removed legacy auth.json');
				return;
			}

			// Otherwise, user needs to re-authenticate
			this.logger.warn('Legacy auth.json found but no valid Supabase session.');
			this.logger.warn('Please run: task-master auth login');
		} catch (error) {
			this.logger.debug('Error during legacy auth migration:', error);
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
		ContextStore.resetInstance();
	}

	/**
	 * Get access token from current Supabase session
	 * @returns Access token or null if not authenticated
	 */
	async getAccessToken(): Promise<string | null> {
		const session = await this.supabaseClient.getSession();
		return session?.access_token || null;
	}

	/**
	 * Get authentication credentials from Supabase session
	 * Modern replacement for legacy getCredentials()
	 * @returns AuthCredentials object or null if not authenticated
	 */
	async getAuthCredentials(): Promise<AuthCredentials | null> {
		const session = await this.supabaseClient.getSession();
		if (!session) return null;

		const user = session.user;
		const context = this.contextStore.getUserContext();

		return {
			token: session.access_token,
			refreshToken: session.refresh_token,
			userId: user.id,
			email: user.email,
			expiresAt: session.expires_at
				? new Date(session.expires_at * 1000).toISOString()
				: undefined,
			tokenType: 'standard',
			savedAt: new Date().toISOString(),
			selectedContext: context || undefined
		};
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
		try {
			this.logger.info('Authenticating with one-time token...');

			// Verify the token and get session from Supabase
			const session = await this.supabaseClient.verifyOneTimeCode(token);

			if (!session || !session.access_token) {
				throw new AuthenticationError(
					'Failed to obtain access token from token',
					'NO_TOKEN'
				);
			}

			// Get user information
			const user = await this.supabaseClient.getUser();

			if (!user) {
				throw new AuthenticationError(
					'Failed to get user information',
					'INVALID_RESPONSE'
				);
			}

			// Store user context
			this.contextStore.saveContext({
				userId: user.id,
				email: user.email
			});

			// Build credentials response
			const context = this.contextStore.getUserContext();
			const credentials: AuthCredentials = {
				token: session.access_token,
				refreshToken: session.refresh_token,
				userId: user.id,
				email: user.email,
				expiresAt: session.expires_at
					? new Date(session.expires_at * 1000).toISOString()
					: undefined,
				tokenType: 'standard',
				savedAt: new Date().toISOString(),
				selectedContext: context || undefined
			};

			this.logger.info('Successfully authenticated with token');
			return credentials;
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}
			throw new AuthenticationError(
				`Token authentication failed: ${(error as Error).message}`,
				'CODE_AUTH_FAILED'
			);
		}
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

		// Clear app context
		this.contextStore.clearContext();
		// Session is cleared by supabaseClient.signOut()

		// Clear legacy auth.json if it exists
		try {
			if (fs.existsSync(this.LEGACY_AUTH_FILE)) {
				fs.unlinkSync(this.LEGACY_AUTH_FILE);
				this.logger.debug('Cleared legacy auth.json');
			}
		} catch (error) {
			// Ignore errors clearing legacy file
			this.logger.debug('No legacy credentials to clear');
		}
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
