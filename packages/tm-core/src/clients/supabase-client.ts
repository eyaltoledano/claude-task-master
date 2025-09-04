/**
 * Supabase client for authentication
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthenticationError } from '../auth/types';
import { getLogger } from '../logger';

export class SupabaseAuthClient {
	private client: SupabaseClient | null = null;
	private logger = getLogger('SupabaseAuthClient');

	/**
	 * Initialize Supabase client
	 */
	private getClient(): SupabaseClient {
		if (!this.client) {
			// Get Supabase configuration from environment - using TM_PUBLIC prefix
			const supabaseUrl = process.env.TM_PUBLIC_SUPABASE_URL;
			const supabaseAnonKey = process.env.TM_PUBLIC_SUPABASE_ANON_KEY;

			if (!supabaseUrl || !supabaseAnonKey) {
				throw new AuthenticationError(
					'Supabase configuration missing. Please set TM_PUBLIC_SUPABASE_URL and TM_PUBLIC_SUPABASE_ANON_KEY environment variables.',
					'CONFIG_MISSING'
				);
			}

			this.client = createClient(supabaseUrl, supabaseAnonKey, {
				auth: {
					autoRefreshToken: true,
					persistSession: false, // We handle persistence ourselves
					detectSessionInUrl: false
				}
			});
		}

		return this.client;
	}

	/**
	 * Note: Code exchange is now handled server-side
	 * The server returns tokens directly to avoid PKCE issues
	 * This method is kept for potential future use
	 */
	async exchangeCodeForSession(_code: string): Promise<{
		token: string;
		refreshToken?: string;
		userId: string;
		email?: string;
		expiresAt?: string;
	}> {
		throw new AuthenticationError(
			'Code exchange is handled server-side. CLI receives tokens directly.',
			'NOT_SUPPORTED'
		);
	}

	/**
	 * Refresh an access token
	 */
	async refreshSession(refreshToken: string): Promise<{
		token: string;
		refreshToken?: string;
		expiresAt?: string;
	}> {
		try {
			const client = this.getClient();

			this.logger.info('Refreshing session...');

			// Set the session with refresh token
			const { data, error } = await client.auth.refreshSession({
				refresh_token: refreshToken
			});

			if (error) {
				this.logger.error('Failed to refresh session:', error);
				throw new AuthenticationError(
					`Failed to refresh session: ${error.message}`,
					'REFRESH_FAILED'
				);
			}

			if (!data.session) {
				throw new AuthenticationError(
					'No session data returned',
					'INVALID_RESPONSE'
				);
			}

			this.logger.info('Successfully refreshed session');

			return {
				token: data.session.access_token,
				refreshToken: data.session.refresh_token,
				expiresAt: data.session.expires_at
					? new Date(data.session.expires_at * 1000).toISOString()
					: undefined
			};
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}

			throw new AuthenticationError(
				`Failed to refresh session: ${(error as Error).message}`,
				'REFRESH_FAILED'
			);
		}
	}

	/**
	 * Get user details from token
	 */
	async getUser(token: string): Promise<User | null> {
		try {
			const client = this.getClient();

			// Get user with the token
			const { data, error } = await client.auth.getUser(token);

			if (error) {
				this.logger.warn('Failed to get user:', error);
				return null;
			}

			return data.user;
		} catch (error) {
			this.logger.error('Error getting user:', error);
			return null;
		}
	}

	/**
	 * Sign out (revoke tokens)
	 * Note: This requires the user to be authenticated with the current session.
	 * For remote token revocation, a server-side admin API with service_role key would be needed.
	 */
	async signOut(): Promise<void> {
		try {
			const client = this.getClient();

			// Sign out the current session with global scope to revoke all refresh tokens
			const { error } = await client.auth.signOut({ scope: 'global' });

			if (error) {
				this.logger.warn('Failed to sign out:', error);
			}
		} catch (error) {
			this.logger.error('Error during sign out:', error);
		}
	}
}
