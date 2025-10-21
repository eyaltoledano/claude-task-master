/**
 * Custom storage adapter for Supabase Auth sessions in CLI environment
 * Implements the SupportedStorage interface required by Supabase Auth
 *
 * This adapter bridges Supabase's session management with our existing
 * auth.json credential storage, maintaining backward compatibility
 */

import type { SupportedStorage } from '@supabase/supabase-js';
import { CredentialStore } from './credential-store.js';
import type { AuthCredentials } from '../types.js';
import { getLogger } from '../../../common/logger/index.js';

const STORAGE_KEY = 'sb-taskmaster-auth-token';

export class SupabaseSessionStorage implements SupportedStorage {
	private store: CredentialStore;
	private logger = getLogger('SupabaseSessionStorage');

	constructor(store: CredentialStore) {
		this.store = store;
	}

	/**
	 * Build a Supabase session object from our credentials
	 */
	private buildSessionFromCredentials(credentials: AuthCredentials): any {
		// Create a session object that Supabase expects
		const session = {
			access_token: credentials.token,
			refresh_token: credentials.refreshToken || '',
			// Don't default to arbitrary values - let Supabase handle refresh
			...(credentials.expiresAt && {
				expires_at: Math.floor(new Date(credentials.expiresAt).getTime() / 1000)
			}),
			token_type: 'bearer',
			user: {
				id: credentials.userId,
				email: credentials.email || ''
			}
		};
		return session;
	}

	/**
	 * Parse a Supabase session back to our credentials
	 */
	private parseSessionToCredentials(
		sessionData: any
	): Partial<AuthCredentials> {
		try {
			// Handle both string and object formats (Supabase may pass either)
			const session =
				typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;

			return {
				token: session.access_token,
				refreshToken: session.refresh_token,
				userId: session.user?.id,
				email: session.user?.email,
				expiresAt: session.expires_at
					? new Date(session.expires_at * 1000).toISOString()
					: undefined
			};
		} catch (error) {
			this.logger.error('Error parsing session:', error);
			return {};
		}
	}

	/**
	 * Get item from storage - Supabase will request the session with a specific key
	 */
	getItem(key: string): string | null {
		// Supabase uses a specific key pattern for sessions
		if (key === STORAGE_KEY || key.includes('auth-token')) {
			try {
				// Get credentials and let Supabase handle expiry/refresh internally
				const credentials = this.store.getCredentials();

				// Only return a session if we have BOTH access token AND refresh token
				// Supabase will handle refresh if session is expired
				if (!credentials?.token || !credentials?.refreshToken) {
					this.logger.debug('No valid credentials found');
					return null;
				}

				const session = this.buildSessionFromCredentials(credentials);
				return JSON.stringify(session);
			} catch (error) {
				this.logger.error('Error getting session:', error);
			}
		}
		// Return null if no valid session exists - Supabase expects this
		return null;
	}

	/**
	 * Set item in storage - Supabase will store the session with a specific key
	 * CRITICAL: This is called during refresh token rotation - must be atomic
	 */
	setItem(key: string, value: string): void {
		// Only handle Supabase session keys
		if (key === STORAGE_KEY || key.includes('auth-token')) {
			try {
				this.logger.info('Supabase called setItem - storing refreshed session');

				// Parse the session and update our credentials
				const sessionUpdates = this.parseSessionToCredentials(value);
				const existingCredentials = this.store.getCredentials({
					allowExpired: true
				});

				// CRITICAL: Only save if we have both tokens - prevents partial session states
				// Refresh token rotation means we MUST persist the new refresh token immediately
				if (!sessionUpdates.token || !sessionUpdates.refreshToken) {
					this.logger.warn(
						'Received incomplete session update - skipping save to prevent token rotation issues',
						{
							hasToken: !!sessionUpdates.token,
							hasRefreshToken: !!sessionUpdates.refreshToken
						}
					);
					return;
				}

				// Log the refresh token rotation for debugging
				const isRotation =
					existingCredentials?.refreshToken !== sessionUpdates.refreshToken;
				if (isRotation) {
					this.logger.debug(
						'Refresh token rotated - storing new refresh token atomically'
					);
				}

				// Build updated credentials - ATOMIC update of both tokens
				const userId = sessionUpdates.userId ?? existingCredentials?.userId;

				// Runtime assertion: userId is required for AuthCredentials
				if (!userId) {
					this.logger.error(
						'Cannot save credentials: userId is missing from both session update and existing credentials'
					);
					throw new Error('Invalid session state: userId is required');
				}

				const updatedCredentials: AuthCredentials = {
					...(existingCredentials ?? {}),
					token: sessionUpdates.token,
					refreshToken: sessionUpdates.refreshToken,
					expiresAt: sessionUpdates.expiresAt,
					userId,
					email: sessionUpdates.email ?? existingCredentials?.email,
					savedAt: new Date().toISOString(),
					selectedContext: existingCredentials?.selectedContext
				} as AuthCredentials;

				// Save synchronously to ensure atomicity during refresh
				this.store.saveCredentials(updatedCredentials);

				this.logger.info(
					'Successfully saved refreshed credentials from Supabase',
					{
						tokenRotated: isRotation,
						expiresAt: updatedCredentials.expiresAt
					}
				);
			} catch (error) {
				this.logger.error('Error setting session:', error);
			}
		}
	}

	/**
	 * Remove item from storage - Called when signing out
	 */
	removeItem(key: string): void {
		if (key === STORAGE_KEY || key.includes('auth-token')) {
			// Don't actually remove credentials, just clear the tokens
			// This preserves other data like selectedContext
			try {
				const credentials = this.store.getCredentials({ allowExpired: true });
				if (credentials) {
					// Keep context but clear auth tokens
					const clearedCredentials: AuthCredentials = {
						...credentials,
						token: '',
						refreshToken: undefined,
						expiresAt: undefined
					} as AuthCredentials;
					this.store.saveCredentials(clearedCredentials);
				}
			} catch (error) {
				this.logger.error('Error removing session:', error);
			}
		}
	}

	/**
	 * Clear all session data
	 */
	clear(): void {
		// Clear auth tokens but preserve context
		this.removeItem(STORAGE_KEY);
	}
}
