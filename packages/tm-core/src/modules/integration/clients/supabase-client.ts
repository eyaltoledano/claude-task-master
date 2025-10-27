/**
 * Supabase authentication client for CLI auth flows
 */

import {
	createClient,
	SupabaseClient as SupabaseJSClient,
	User,
	Session
} from '@supabase/supabase-js';
import { AuthenticationError } from '../../auth/types.js';
import { getLogger } from '../../../common/logger/index.js';
import { SupabaseSessionStorage } from '../../auth/services/supabase-session-storage.js';

export class SupabaseAuthClient {
	private client: SupabaseJSClient | null = null;
	private sessionStorage: SupabaseSessionStorage;
	private logger = getLogger('SupabaseAuthClient');

	constructor() {
		this.sessionStorage = new SupabaseSessionStorage();
	}

	/**
	 * Get Supabase client with proper session management
	 */
	getClient(): SupabaseJSClient {
		if (!this.client) {
			// Get Supabase configuration from environment
			// Runtime vars (TM_*) take precedence over build-time vars (TM_PUBLIC_*)
			const supabaseUrl =
				process.env.TM_SUPABASE_URL || process.env.TM_PUBLIC_SUPABASE_URL;
			const supabaseAnonKey =
				process.env.TM_SUPABASE_ANON_KEY ||
				process.env.TM_PUBLIC_SUPABASE_ANON_KEY;

			if (!supabaseUrl || !supabaseAnonKey) {
				throw new AuthenticationError(
					'Supabase configuration missing. Please set TM_SUPABASE_URL and TM_SUPABASE_ANON_KEY (runtime) or TM_PUBLIC_SUPABASE_URL and TM_PUBLIC_SUPABASE_ANON_KEY (build-time) environment variables.',
					'CONFIG_MISSING'
				);
			}

			// Create client with custom storage adapter (similar to React Native AsyncStorage)
			this.client = createClient(supabaseUrl, supabaseAnonKey, {
				auth: {
					storage: this.sessionStorage,
					autoRefreshToken: true,
					persistSession: true,
					detectSessionInUrl: false
				}
			});
		}

		return this.client;
	}

	/**
	 * Initialize the client and restore session if available
	 */
	async initialize(): Promise<Session | null> {
		const client = this.getClient();

		try {
			// Get the current session from storage
			const {
				data: { session },
				error
			} = await client.auth.getSession();

			if (error) {
				this.logger.warn('Failed to restore session:', error);
				return null;
			}

			if (session) {
				this.logger.info('Session restored successfully');
			}

			return session;
		} catch (error) {
			this.logger.error('Error initializing session:', error);
			return null;
		}
	}

	/**
	 * Sign in with PKCE flow (for CLI auth)
	 */
	async signInWithPKCE(): Promise<{ url: string; codeVerifier: string }> {
		const client = this.getClient();

		try {
			// Generate PKCE challenge
			const { data, error } = await client.auth.signInWithOAuth({
				provider: 'github',
				options: {
					redirectTo:
						process.env.TM_AUTH_CALLBACK_URL ||
						'http://localhost:3421/auth/callback',
					scopes: 'email'
				}
			});

			if (error) {
				throw new AuthenticationError(
					`Failed to initiate PKCE flow: ${error.message}`,
					'PKCE_INIT_FAILED'
				);
			}

			if (!data?.url) {
				throw new AuthenticationError(
					'No authorization URL returned',
					'INVALID_RESPONSE'
				);
			}

			// Extract code_verifier from the URL or generate it
			// Note: Supabase handles PKCE internally, we just need to handle the callback
			return {
				url: data.url,
				codeVerifier: '' // Supabase manages this internally
			};
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}

			throw new AuthenticationError(
				`Failed to start PKCE flow: ${(error as Error).message}`,
				'PKCE_FAILED'
			);
		}
	}

	/**
	 * Exchange authorization code for session (PKCE flow)
	 */
	async exchangeCodeForSession(code: string): Promise<Session> {
		const client = this.getClient();

		try {
			const { data, error } = await client.auth.exchangeCodeForSession(code);

			if (error) {
				throw new AuthenticationError(
					`Failed to exchange code: ${error.message}`,
					'CODE_EXCHANGE_FAILED'
				);
			}

			if (!data?.session) {
				throw new AuthenticationError(
					'No session returned from code exchange',
					'INVALID_RESPONSE'
				);
			}

			this.logger.info('Successfully exchanged code for session');
			return data.session;
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}

			throw new AuthenticationError(
				`Code exchange failed: ${(error as Error).message}`,
				'CODE_EXCHANGE_FAILED'
			);
		}
	}

	/**
	 * Get the current session
	 */
	async getSession(): Promise<Session | null> {
		const client = this.getClient();

		try {
			const {
				data: { session },
				error
			} = await client.auth.getSession();

			if (error) {
				this.logger.warn('Failed to get session:', error);
				return null;
			}

			return session;
		} catch (error) {
			this.logger.error('Error getting session:', error);
			return null;
		}
	}

	/**
	 * Refresh the current session
	 */
	async refreshSession(): Promise<Session | null> {
		const client = this.getClient();

		try {
			this.logger.info('Refreshing session...');

			// Supabase will automatically use the stored refresh token
			const {
				data: { session },
				error
			} = await client.auth.refreshSession();

			if (error) {
				this.logger.error('Failed to refresh session:', error);
				throw new AuthenticationError(
					`Failed to refresh session: ${error.message}`,
					'REFRESH_FAILED'
				);
			}

			if (session) {
				this.logger.info('Successfully refreshed session');
			}

			return session;
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
	 * Get current user from session
	 */
	async getUser(): Promise<User | null> {
		const client = this.getClient();

		try {
			const {
				data: { user },
				error
			} = await client.auth.getUser();

			if (error) {
				this.logger.warn('Failed to get user:', error);
				return null;
			}

			return user;
		} catch (error) {
			this.logger.error('Error getting user:', error);
			return null;
		}
	}

	/**
	 * Sign out and clear session
	 */
	async signOut(): Promise<void> {
		const client = this.getClient();

		try {
			// Sign out with global scope to revoke all refresh tokens
			const { error } = await client.auth.signOut({ scope: 'global' });

			if (error) {
				this.logger.warn('Failed to sign out:', error);
			}

			// Clear cached session data
			this.sessionStorage.clear();
		} catch (error) {
			this.logger.error('Error during sign out:', error);
		}
	}

	/**
	 * Set session from external auth (e.g., from server callback)
	 */
	async setSession(session: Session): Promise<void> {
		const client = this.getClient();

		try {
			const { error } = await client.auth.setSession({
				access_token: session.access_token,
				refresh_token: session.refresh_token
			});

			if (error) {
				throw new AuthenticationError(
					`Failed to set session: ${error.message}`,
					'SESSION_SET_FAILED'
				);
			}

			this.logger.info('Session set successfully');
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}

			throw new AuthenticationError(
				`Failed to set session: ${(error as Error).message}`,
				'SESSION_SET_FAILED'
			);
		}
	}

	/**
	 * Verify a one-time token and create a session
	 * Used for CLI authentication with pre-generated tokens
	 */
	async verifyOneTimeCode(token: string): Promise<Session> {
		const client = this.getClient();

		try {
			this.logger.info('Verifying authentication token...');

			// Use Supabase's verifyOtp for token verification
			// Using token_hash with magiclink type doesn't require email
			const { data, error } = await client.auth.verifyOtp({
				token_hash: token,
				type: 'magiclink'
			});

			if (error) {
				this.logger.error('Failed to verify token:', error);
				throw new AuthenticationError(
					`Failed to verify token: ${error.message}`,
					'INVALID_CODE'
				);
			}

			if (!data?.session) {
				throw new AuthenticationError(
					'No session returned from token verification',
					'INVALID_RESPONSE'
				);
			}

			this.logger.info('Successfully verified authentication token');
			return data.session;
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}

			throw new AuthenticationError(
				`Token verification failed: ${(error as Error).message}`,
				'CODE_AUTH_FAILED'
			);
		}
	}
}
