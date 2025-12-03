/**
 * Session Manager
 * Handles session initialization, authentication, and lifecycle management
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { getLogger } from '../../../common/logger/index.js';
import { SupabaseAuthClient } from '../../integration/clients/supabase-client.js';
import type { AuthCredentials } from '../types.js';
import { AuthenticationError } from '../types.js';
import { ContextStore } from './context-store.js';

/**
 * SessionManager - Focused service for session and token management
 */
export class SessionManager {
	private readonly logger = getLogger('SessionManager');
	private readonly LEGACY_AUTH_FILE = path.join(
		os.homedir(),
		'.taskmaster',
		'auth.json'
	);
	private initializationPromise: Promise<void>;

	constructor(
		private supabaseClient: SupabaseAuthClient,
		private contextStore: ContextStore
	) {
		// Initialize session with proper promise tracking to prevent race conditions
		this.initializationPromise = this.initialize();
	}

	/**
	 * Initialize session - called once during construction
	 * Ensures all async initialization completes before session operations
	 */
	private async initialize(): Promise<void> {
		try {
			await this.initializeSupabaseSession();
			await this.migrateLegacyAuth();
		} catch (error) {
			// Log but don't throw - initialization errors are handled gracefully
			this.logger.debug(
				'Session initialization completed with warnings',
				error
			);
		}
	}

	/**
	 * Wait for initialization to complete
	 * Call this before any operation that depends on session state
	 */
	async waitForInitialization(): Promise<void> {
		await this.initializationPromise;
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
	 * Called once during SessionManager initialization
	 */
	private async migrateLegacyAuth(): Promise<void> {
		if (!fs.existsSync(this.LEGACY_AUTH_FILE)) {
			return;
		}

		try {
			// Check if we have a valid Supabase session (don't use hasValidSession to avoid circular wait)
			const session = await this.supabaseClient.getSession();
			if (session) {
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

	// ========== Session State ==========

	/**
	 * Check if valid Supabase session exists
	 * @returns true if a valid session exists
	 */
	async hasValidSession(): Promise<boolean> {
		await this.waitForInitialization();
		try {
			const session = await this.supabaseClient.getSession();
			return session != null;
		} catch {
			return false;
		}
	}

	/**
	 * Get the current Supabase session
	 */
	async getSession() {
		await this.waitForInitialization();
		return this.supabaseClient.getSession();
	}

	/**
	 * Get stored user context (userId, email)
	 */
	getStoredContext() {
		return this.contextStore.getContext();
	}

	// ========== Token Operations ==========

	/**
	 * Get access token from current Supabase session
	 * @returns Access token or null if not authenticated
	 */
	async getAccessToken(): Promise<string | null> {
		await this.waitForInitialization();
		const session = await this.supabaseClient.getSession();
		return session?.access_token || null;
	}

	/**
	 * Get authentication credentials from Supabase session
	 * Modern replacement for legacy getCredentials()
	 * @returns AuthCredentials object or null if not authenticated
	 */
	async getAuthCredentials(): Promise<AuthCredentials | null> {
		await this.waitForInitialization();
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
	 * Refresh authentication token using Supabase session
	 * Note: Supabase handles token refresh automatically via the session storage adapter.
	 * This method is mainly for explicit refresh requests.
	 */
	async refreshToken(): Promise<AuthCredentials> {
		await this.waitForInitialization();
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

	// ========== Authentication ==========

	/**
	 * Authenticate using a one-time token
	 * This is useful for CLI authentication in SSH/remote environments
	 * where browser-based auth is not practical
	 */
	async authenticateWithCode(token: string): Promise<AuthCredentials> {
		await this.waitForInitialization();
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

			// Check if MFA is required for this user
			const mfaCheck = await this.supabaseClient.checkMFARequired();

			if (mfaCheck.required && mfaCheck.factorId && mfaCheck.factorType) {
				// MFA is required - throw an error with the MFA challenge information
				throw new AuthenticationError(
					'MFA verification required. Please provide your authentication code.',
					'MFA_REQUIRED',
					undefined,
					{
						factorId: mfaCheck.factorId,
						factorType: mfaCheck.factorType
					}
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
	 * Verify MFA code and complete authentication
	 * Call this after authenticateWithCode() throws MFA_REQUIRED error
	 */
	async verifyMFA(factorId: string, code: string): Promise<AuthCredentials> {
		await this.waitForInitialization();
		try {
			this.logger.info('Verifying MFA code...');

			// Verify MFA code and get upgraded session
			const session = await this.supabaseClient.verifyMFA(factorId, code);

			if (!session || !session.access_token) {
				throw new AuthenticationError(
					'Failed to obtain access token after MFA verification',
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

			this.logger.info('Successfully verified MFA and authenticated');
			return credentials;
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}
			throw new AuthenticationError(
				`MFA verification failed: ${(error as Error).message}`,
				'MFA_VERIFICATION_FAILED'
			);
		}
	}

	// ========== Session Lifecycle ==========

	/**
	 * Logout and clear credentials
	 */
	async logout(): Promise<void> {
		await this.waitForInitialization();
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
}
