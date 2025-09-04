/**
 * Authentication manager for Task Master CLI
 */

import {
	AuthCredentials,
	OAuthFlowOptions,
	AuthenticationError,
	AuthConfig
} from './types.js';
import { CredentialStore } from './credential-store.js';
import { OAuthService } from './oauth-service.js';
import { SupabaseAuthClient } from '../clients/supabase-client.js';
import { getLogger } from '../logger/index.js';

/**
 * Authentication manager class
 */
export class AuthManager {
	private static instance: AuthManager;
	private credentialStore: CredentialStore;
	private oauthService: OAuthService;
	private supabaseClient: SupabaseAuthClient;

	private constructor(config?: Partial<AuthConfig>) {
		this.credentialStore = new CredentialStore(config);
		this.supabaseClient = new SupabaseAuthClient();
		this.oauthService = new OAuthService(this.credentialStore, config);
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
		AuthManager.instance = null as any;
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
	 * Authenticate with API key
	 * Note: This would require a custom implementation or Supabase RLS policies
	 */
	async authenticateWithApiKey(apiKey: string): Promise<AuthCredentials> {
		const token = apiKey.trim();
		if (!token || token.length < 10) {
			throw new AuthenticationError('Invalid API key', 'INVALID_API_KEY');
		}

		const authData: AuthCredentials = {
			token,
			tokenType: 'api_key',
			userId: 'api-user',
			email: undefined,
			expiresAt: undefined, // API keys don't expire
			savedAt: new Date().toISOString()
		};

		this.credentialStore.saveCredentials(authData);
		return authData;
	}

	/**
	 * Refresh authentication token
	 */
	async refreshToken(): Promise<AuthCredentials> {
		const authData = this.credentialStore.getCredentials({
			allowExpired: true
		});

		if (!authData || !authData.refreshToken) {
			throw new AuthenticationError(
				'No refresh token available',
				'NO_REFRESH_TOKEN'
			);
		}

		try {
			// Use Supabase client to refresh the token
			const response = await this.supabaseClient.refreshSession(
				authData.refreshToken
			);

			// Update authentication data
			const newAuthData: AuthCredentials = {
				...authData,
				token: response.token,
				refreshToken: response.refreshToken,
				expiresAt: response.expiresAt,
				savedAt: new Date().toISOString()
			};

			this.credentialStore.saveCredentials(newAuthData);
			return newAuthData;
		} catch (error) {
			throw error;
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
			console.warn('Failed to sign out from Supabase:', error);
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
}
