/**
 * Custom storage adapter for Supabase Auth sessions in CLI environment
 * Implements the SupportedStorage interface required by Supabase Auth
 *
 * This adapter bridges Supabase's session management with our existing
 * auth.json credential storage, maintaining backward compatibility
 */

import { SupportedStorage } from '@supabase/supabase-js';
import { CredentialStore } from './credential-store.js';
import { AuthCredentials } from './types.js';
import { getLogger } from '../logger/index.js';

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
			expires_at: credentials.expiresAt
				? Math.floor(new Date(credentials.expiresAt).getTime() / 1000)
				: Math.floor(Date.now() / 1000) + 3600, // Default to 1 hour
			token_type: 'bearer',
			user: {
				id: credentials.userId,
				email: credentials.email || '',
				aud: 'authenticated',
				role: 'authenticated',
				email_confirmed_at: new Date().toISOString(),
				app_metadata: {},
				user_metadata: {},
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
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
			const session = JSON.parse(sessionData);
			return {
				token: session.access_token,
				refreshToken: session.refresh_token,
				userId: session.user?.id || 'unknown',
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
				const credentials = this.store.getCredentials({ allowExpired: true });
				if (credentials && credentials.token) {
					// Build and return a session object from our stored credentials
					const session = this.buildSessionFromCredentials(credentials);
					return JSON.stringify(session);
				}
			} catch (error) {
				this.logger.error('Error getting session:', error);
			}
		}
		return null;
	}

	/**
	 * Set item in storage - Supabase will store the session with a specific key
	 */
	setItem(key: string, value: string): void {
		// Only handle Supabase session keys
		if (key === STORAGE_KEY || key.includes('auth-token')) {
			try {
				// Parse the session and update our credentials
				const sessionUpdates = this.parseSessionToCredentials(value);
				const existingCredentials = this.store.getCredentials({
					allowExpired: true
				});

				if (sessionUpdates.token) {
					const updatedCredentials: AuthCredentials = {
						...existingCredentials,
						...sessionUpdates,
						savedAt: new Date().toISOString(),
						selectedContext: existingCredentials?.selectedContext
					} as AuthCredentials;

					this.store.saveCredentials(updatedCredentials);
				}
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
