/**
 * Supabase authentication client for CLI auth flows
 */

import {
	type AuthError,
	type Session,
	type SupabaseClient as SupabaseJSClient,
	type User,
	createClient
} from '@supabase/supabase-js';
import { getLogger } from '../../../common/logger/index.js';
import { SupabaseSessionStorage } from '../../auth/services/supabase-session-storage.js';
import { AuthenticationError } from '../../auth/types.js';

/**
 * Check if an error is a Supabase auth error
 * Supabase auth errors have __isAuthError: true and a code property
 */
function isSupabaseAuthError(
	error: unknown
): error is AuthError & { code?: string } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'__isAuthError' in error &&
		(error as Record<string, unknown>).__isAuthError === true
	);
}

/**
 * User-friendly error messages for common Supabase auth error codes
 * Note: refresh_token_not_found and refresh_token_already_used are expected
 * during MFA flows and should not trigger these messages in that context.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
	refresh_token_not_found:
		'Your session has expired. Please log in again with: task-master login',
	refresh_token_already_used:
		'Your session has expired (token was already used). Please log in again with: task-master login',
	invalid_refresh_token:
		'Your session has expired (invalid token). Please log in again with: task-master login',
	session_expired:
		'Your session has expired. Please log in again with: task-master login',
	user_not_found:
		'User account not found. Please log in again with: task-master login',
	invalid_credentials:
		'Invalid credentials. Please log in again with: task-master login'
};

/**
 * Error codes caused by stale sessions that can be recovered from
 * by clearing the session storage and retrying.
 *
 * These errors occur when there's a stale session with an invalid refresh token
 * and Supabase tries to use it during authentication. The fix is to clear
 * the stale session and retry the operation.
 */
const RECOVERABLE_STALE_SESSION_ERRORS = [
	'refresh_token_not_found',
	'refresh_token_already_used'
];

/**
 * Check if an error is caused by a stale session and can be recovered
 * by clearing the session storage and retrying.
 */
function isRecoverableStaleSessionError(error: unknown): boolean {
	if (!isSupabaseAuthError(error)) return false;
	return RECOVERABLE_STALE_SESSION_ERRORS.includes(error.code || '');
}

/**
 * Convert a Supabase auth error to a user-friendly AuthenticationError
 */
function toAuthenticationError(
	error: AuthError,
	defaultMessage: string
): AuthenticationError {
	const code = (error as AuthError).code;
	const userMessage = code
		? AUTH_ERROR_MESSAGES[code] || `${defaultMessage}: ${error.message}`
		: `${defaultMessage}: ${error.message}`;

	// Map Supabase error codes to our AuthErrorCode
	let authErrorCode: 'REFRESH_FAILED' | 'NOT_AUTHENTICATED' | 'INVALID_CODE' =
		'REFRESH_FAILED';
	if (
		code === 'refresh_token_not_found' ||
		code === 'refresh_token_already_used' ||
		code === 'invalid_refresh_token' ||
		code === 'session_expired'
	) {
		authErrorCode = 'NOT_AUTHENTICATED';
	} else if (code === 'invalid_credentials' || code === 'user_not_found') {
		authErrorCode = 'INVALID_CODE';
	}

	return new AuthenticationError(userMessage, authErrorCode, error);
}

export class SupabaseAuthClient {
	private static instance: SupabaseAuthClient | null = null;
	private client: SupabaseJSClient | null = null;
	private sessionStorage: SupabaseSessionStorage;
	private logger = getLogger('SupabaseAuthClient');

	/**
	 * Private constructor to enforce singleton pattern.
	 * Use SupabaseAuthClient.getInstance() instead.
	 */
	private constructor() {
		this.sessionStorage = new SupabaseSessionStorage();
	}

	/**
	 * Get the singleton instance of SupabaseAuthClient.
	 * This ensures only one Supabase client exists to prevent
	 * "refresh_token_already_used" errors from concurrent refresh attempts.
	 */
	static getInstance(): SupabaseAuthClient {
		if (!SupabaseAuthClient.instance) {
			SupabaseAuthClient.instance = new SupabaseAuthClient();
		}
		return SupabaseAuthClient.instance;
	}

	/**
	 * Reset the singleton instance (for testing purposes only)
	 * Also nullifies the internal client to ensure no stale Supabase client
	 * references persist across test resets
	 */
	static resetInstance(): void {
		if (SupabaseAuthClient.instance) {
			SupabaseAuthClient.instance.client = null;
		}
		SupabaseAuthClient.instance = null;
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
				// MFA-expected errors are normal during auth flows - don't log warnings
				if (!isRecoverableStaleSessionError(error)) {
					this.logger.warn('Failed to restore session:', error);
				}
				return null;
			}

			if (session) {
				this.logger.info('Session restored successfully');
			}

			return session;
		} catch (error) {
			// MFA-expected errors (refresh_token_not_found, etc.) are normal during auth flows
			if (isRecoverableStaleSessionError(error)) {
				this.logger.debug('Session not available (expected during MFA flow)');
			} else if (isSupabaseAuthError(error)) {
				this.logger.warn('Session expired or invalid');
			} else {
				this.logger.error('Error initializing session:', error);
			}
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
				// MFA-expected errors are normal during auth flows - don't log warnings
				if (!isRecoverableStaleSessionError(error)) {
					this.logger.warn('Failed to get session:', error);
				}
				return null;
			}

			return session;
		} catch (error) {
			// MFA-expected errors (refresh_token_not_found, etc.) are normal during auth flows
			if (isRecoverableStaleSessionError(error)) {
				this.logger.debug('Session not available (expected during MFA flow)');
			} else if (isSupabaseAuthError(error)) {
				this.logger.warn('Session expired or invalid');
			} else {
				this.logger.error('Error getting session:', error);
			}
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
				// Use user-friendly error message for known Supabase auth errors
				throw toAuthenticationError(error, 'Failed to refresh session');
			}

			if (session) {
				this.logger.info('Successfully refreshed session');
			}

			return session;
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}

			// Handle raw Supabase auth errors that might be thrown
			if (isSupabaseAuthError(error)) {
				throw toAuthenticationError(error, 'Session refresh failed');
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
			// Sign out with local scope to clear only this device's session
			const { error } = await client.auth.signOut({ scope: 'local' });

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
	 *
	 * Note: If MFA is enabled and there's a stale session, Supabase might throw
	 * refresh_token_not_found errors. We handle this by clearing the stale session
	 * and retrying once.
	 */
	async verifyOneTimeCode(token: string, isRetry = false): Promise<Session> {
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
				// If this is an MFA-expected error (like refresh_token_not_found),
				// it might be due to a stale session interfering. Clear and retry once.
				if (!isRetry && isRecoverableStaleSessionError(error)) {
					this.logger.debug(
						'MFA-expected error during token verification, clearing stale session and retrying'
					);
					await this.sessionStorage.clear();
					return this.verifyOneTimeCode(token, true);
				}

				this.logger.error('Failed to verify token:', error);
				// Use user-friendly error message for known Supabase auth errors
				throw toAuthenticationError(error, 'Failed to verify token');
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

			// Handle raw Supabase auth errors that might be thrown
			if (isSupabaseAuthError(error)) {
				// If this is an MFA-expected error and we haven't retried, clear session and retry
				if (!isRetry && isRecoverableStaleSessionError(error)) {
					this.logger.debug(
						'MFA-expected error during token verification, clearing stale session and retrying'
					);
					await this.sessionStorage.clear();
					return this.verifyOneTimeCode(token, true);
				}
				throw toAuthenticationError(error, 'Token verification failed');
			}

			throw new AuthenticationError(
				`Token verification failed: ${(error as Error).message}`,
				'CODE_AUTH_FAILED'
			);
		}
	}

	/**
	 * Check if MFA is required for the current session
	 * @returns Object with required=true and factor details if MFA is required,
	 *          or required=false if session is already at AAL2 or no MFA is configured
	 */
	async checkMFARequired(): Promise<{
		required: boolean;
		factorId?: string;
		factorType?: string;
	}> {
		const client = this.getClient();

		try {
			// Get the current session
			const {
				data: { session },
				error: sessionError
			} = await client.auth.getSession();

			if (sessionError || !session) {
				this.logger.warn('No session available to check MFA');
				return { required: false };
			}

			// Check the current Authentication Assurance Level (AAL)
			// AAL1 = basic authentication (password/oauth)
			// AAL2 = MFA verified
			const { data: aalData, error: aalError } =
				await client.auth.mfa.getAuthenticatorAssuranceLevel();

			if (aalError) {
				this.logger.warn('Failed to get AAL:', aalError);
				return { required: false };
			}

			// If already at AAL2, MFA is not required
			if (aalData?.currentLevel === 'aal2') {
				this.logger.info('Session already at AAL2, MFA not required');
				return { required: false };
			}

			// Get MFA factors for this user
			const { data: factors, error: factorsError } =
				await client.auth.mfa.listFactors();

			if (factorsError) {
				this.logger.warn('Failed to list MFA factors:', factorsError);
				return { required: false };
			}

			// Check if user has any verified MFA factors
			const verifiedFactors = factors?.totp?.filter(
				(factor) => factor.status === 'verified'
			);

			if (!verifiedFactors || verifiedFactors.length === 0) {
				this.logger.info('No verified MFA factors found');
				return { required: false };
			}

			// MFA is required - user has MFA enabled but session is only at AAL1
			const factor = verifiedFactors[0]; // Use the first verified factor
			this.logger.info('MFA verification required', {
				factorId: factor.id,
				factorType: factor.factor_type
			});

			return {
				required: true,
				factorId: factor.id,
				factorType: factor.factor_type
			};
		} catch (error) {
			this.logger.error('Error checking MFA requirement:', error);
			return { required: false };
		}
	}

	/**
	 * Verify MFA code and upgrade session to AAL2
	 */
	async verifyMFA(factorId: string, code: string): Promise<Session> {
		const client = this.getClient();

		try {
			this.logger.info('Verifying MFA code...');

			// Create MFA challenge
			const { data: challengeData, error: challengeError } =
				await client.auth.mfa.challenge({ factorId });

			if (challengeError || !challengeData) {
				throw new AuthenticationError(
					`Failed to create MFA challenge: ${challengeError?.message || 'Unknown error'}`,
					'MFA_VERIFICATION_FAILED'
				);
			}

			// Verify the TOTP code
			const { data, error } = await client.auth.mfa.verify({
				factorId,
				challengeId: challengeData.id,
				code
			});

			if (error) {
				this.logger.error('MFA verification failed:', error);
				throw new AuthenticationError(
					`Invalid MFA code: ${error.message}`,
					'INVALID_MFA_CODE'
				);
			}

			if (!data) {
				throw new AuthenticationError(
					'No data returned from MFA verification',
					'INVALID_RESPONSE'
				);
			}

			// After successful MFA verification, refresh the session to get the upgraded AAL2 session
			const {
				data: { session },
				error: refreshError
			} = await client.auth.refreshSession();

			if (refreshError || !session) {
				throw new AuthenticationError(
					`Failed to refresh session after MFA: ${refreshError?.message || 'No session returned'}`,
					'REFRESH_FAILED'
				);
			}

			this.logger.info('Successfully verified MFA, session upgraded to AAL2');
			return session;
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
}
