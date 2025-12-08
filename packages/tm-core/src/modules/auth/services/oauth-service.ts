/**
 * OAuth 2.0 Authorization Code Flow service
 *
 * Uses backend PKCE flow with E2E encryption:
 * - CLI generates RSA keypair and sends public key to backend
 * - Backend manages PKCE params (code_verifier never leaves server)
 * - Backend encrypts tokens with CLI's public key before storage
 * - CLI decrypts tokens with private key (tokens never stored in plaintext on server)
 */

import os from 'os';
import type { Session } from '@supabase/supabase-js';
import { TASKMASTER_VERSION } from '../../../common/constants/index.js';
import { getLogger } from '../../../common/logger/index.js';
import type { SupabaseAuthClient } from '../../integration/clients/supabase-client.js';
import { getAuthConfig } from '../config.js';
import type { ContextStore } from '../services/context-store.js';
import {
	type AuthConfig,
	type AuthCredentials,
	AuthenticationError,
	type MFAChallenge,
	type OAuthFlowOptions
} from '../types.js';
import {
	type AuthKeyPair,
	type EncryptedTokenPayload,
	decryptTokens,
	generateKeyPair
} from '../utils/cli-crypto.js';

/**
 * Response from POST /api/auth/cli/start
 */
interface StartFlowResponse {
	success: boolean;
	flow_id?: string;
	verification_url?: string;
	expires_at?: string;
	poll_interval?: number;
	error?: string;
	message?: string;
}

/**
 * Response from GET /api/auth/cli/status
 */
interface FlowStatusResponse {
	success: boolean;
	status?: 'pending' | 'authenticating' | 'complete' | 'failed' | 'expired';
	encrypted_tokens?: EncryptedTokenPayload;
	user_id?: string;
	error?: string;
	error_description?: string;
	message?: string;
}

export class OAuthService {
	private logger = getLogger('OAuthService');
	private contextStore: ContextStore;
	private supabaseClient: SupabaseAuthClient;
	private baseUrl: string;
	private authorizationUrl: string | null = null;
	private keyPair: AuthKeyPair | null = null;

	constructor(
		contextStore: ContextStore,
		supabaseClient: SupabaseAuthClient,
		config: Partial<AuthConfig> = {}
	) {
		this.contextStore = contextStore;
		this.supabaseClient = supabaseClient;
		const authConfig = getAuthConfig(config);
		this.baseUrl = authConfig.baseUrl;
	}

	/**
	 * Start OAuth 2.0 Authorization Code Flow with browser handling
	 *
	 * Uses secure backend PKCE flow where:
	 * - CLI calls backend to start flow
	 * - Backend manages PKCE params (code_verifier never leaves server)
	 * - CLI polls backend for completion
	 */
	async authenticate(options: OAuthFlowOptions = {}): Promise<AuthCredentials> {
		const {
			openBrowser,
			timeout = 300000, // 5 minutes default
			onAuthUrl,
			onWaitingForAuth,
			onSuccess,
			onError
		} = options;

		try {
			return await this.authenticateWithBackendPKCE({
				openBrowser,
				timeout,
				onAuthUrl,
				onWaitingForAuth,
				onSuccess
			});
		} catch (error) {
			const authError =
				error instanceof AuthenticationError
					? error
					: new AuthenticationError(
							`OAuth authentication failed: ${(error as Error).message}`,
							'OAUTH_FAILED',
							error
						);

			// Only notify error for actual failures, NOT for MFA_REQUIRED
			// MFA requirement is a continuation of the auth flow, not an error
			if (onError && authError.code !== 'MFA_REQUIRED') {
				onError(authError);
			}

			throw authError;
		}
	}

	/**
	 * Authenticate using backend-managed PKCE flow with E2E encryption
	 *
	 * This is the secure flow where:
	 * 1. CLI generates RSA keypair for E2E encryption
	 * 2. CLI calls POST /api/auth/cli/start with public key
	 * 3. Backend generates PKCE params and stores them with public key
	 * 4. CLI opens browser with verification URL
	 * 5. User authenticates in browser
	 * 6. Backend exchanges code for session, encrypts tokens with public key
	 * 7. CLI polls GET /api/auth/cli/status until complete
	 * 8. CLI decrypts tokens with private key
	 */
	private async authenticateWithBackendPKCE(
		options: OAuthFlowOptions
	): Promise<AuthCredentials> {
		const {
			openBrowser,
			timeout = 300000,
			onAuthUrl,
			onWaitingForAuth,
			onSuccess
		} = options;

		// Step 1: Generate keypair for E2E encryption
		this.keyPair = generateKeyPair();
		this.logger.debug('Generated RSA keypair for E2E encryption');

		// Step 2: Start the flow on the backend with our public key
		const startResponse = await this.startBackendFlow();

		if (!startResponse.success || !startResponse.flow_id) {
			throw new AuthenticationError(
				startResponse.message || 'Failed to start authentication flow',
				'START_FLOW_FAILED'
			);
		}

		const { flow_id, verification_url, poll_interval = 2 } = startResponse;

		// Store the auth URL
		this.authorizationUrl = verification_url || null;

		// Notify about the auth URL
		if (onAuthUrl && verification_url) {
			onAuthUrl(verification_url);
		}

		// Step 3: Open browser with verification URL
		if (openBrowser && verification_url) {
			try {
				await openBrowser(verification_url);
				this.logger.debug(
					'Browser opened successfully with URL:',
					verification_url
				);
			} catch (error) {
				this.logger.warn('Failed to open browser automatically:', error);
			}
		}

		// Notify that we're waiting for authentication
		if (onWaitingForAuth) {
			onWaitingForAuth();
		}

		// Step 4: Poll for completion
		const credentials = await this.pollForCompletion(
			flow_id,
			poll_interval * 1000,
			timeout
		);

		// Set the session in Supabase client
		// Note: Only set session if we have a valid refresh token
		// Supabase requires a valid refresh_token to manage token lifecycle
		if (!credentials.refreshToken) {
			this.logger.warn(
				'No refresh token received from server - session refresh will not work'
			);
		}

		const session: Session = {
			access_token: credentials.token,
			refresh_token: credentials.refreshToken ?? '',
			expires_in: credentials.expiresAt
				? Math.floor(
						(new Date(credentials.expiresAt).getTime() - Date.now()) / 1000
					)
				: 3600,
			token_type: 'bearer',
			user: {
				id: credentials.userId,
				email: credentials.email,
				app_metadata: {},
				user_metadata: {},
				aud: 'authenticated',
				created_at: ''
			}
		};

		await this.supabaseClient.setSession(session);

		// Save user info to context store
		this.contextStore.saveContext({
			userId: credentials.userId,
			email: credentials.email
		});

		// Check if MFA is required
		await this.checkAndThrowIfMFARequired();

		// Notify success
		if (onSuccess) {
			onSuccess(credentials);
		}

		return credentials;
	}

	/**
	 * Start a new authentication flow on the backend
	 */
	private async startBackendFlow(): Promise<StartFlowResponse> {
		const startUrl = `${this.baseUrl}/api/auth/cli/start`;

		if (!this.keyPair) {
			throw new AuthenticationError(
				'Keypair not generated before starting flow',
				'INTERNAL_ERROR'
			);
		}

		try {
			const response = await fetch(startUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': `TaskMasterCLI/${this.getCliVersion()}`
				},
				body: JSON.stringify({
					name: 'Task Master CLI',
					version: this.getCliVersion(),
					device: os.hostname(),
					user: os.userInfo().username,
					platform: os.platform(),
					public_key: this.keyPair.publicKey
				})
			});

			if (!response.ok) {
				const errorData = (await response.json().catch(() => ({}))) as {
					message?: string;
				};
				throw new AuthenticationError(
					errorData.message || `HTTP ${response.status}`,
					'START_FLOW_FAILED'
				);
			}

			return (await response.json()) as StartFlowResponse;
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}

			// Network errors indicate backend is unreachable
			this.logger.warn('Failed to reach backend for PKCE flow:', error);
			throw new AuthenticationError(
				'Unable to reach authentication server',
				'BACKEND_UNREACHABLE',
				error
			);
		}
	}

	/**
	 * Poll the backend for flow completion
	 */
	private async pollForCompletion(
		flowId: string,
		pollInterval: number,
		timeout: number
	): Promise<AuthCredentials> {
		const statusUrl = `${this.baseUrl}/api/auth/cli/status?flow_id=${flowId}`;
		const startTime = Date.now();

		if (!this.keyPair) {
			throw new AuthenticationError(
				'Keypair not available for decryption',
				'INTERNAL_ERROR'
			);
		}

		while (Date.now() - startTime < timeout) {
			try {
				const response = await fetch(statusUrl, {
					method: 'GET',
					headers: {
						'User-Agent': `TaskMasterCLI/${this.getCliVersion()}`
					}
				});

				if (!response.ok) {
					const errorData = (await response.json().catch(() => ({}))) as {
						message?: string;
					};

					if (response.status === 404) {
						throw new AuthenticationError(
							'Authentication flow expired or not found',
							'FLOW_NOT_FOUND'
						);
					}

					throw new AuthenticationError(
						errorData.message || `HTTP ${response.status}`,
						'POLL_FAILED'
					);
				}

				const data = (await response.json()) as FlowStatusResponse;

				if (!data.success) {
					throw new AuthenticationError(
						data.message || 'Failed to check status',
						'POLL_FAILED'
					);
				}

				switch (data.status) {
					case 'complete': {
						// Decrypt tokens using our private key
						if (!data.encrypted_tokens) {
							throw new AuthenticationError(
								'Server returned no encrypted tokens',
								'MISSING_TOKENS'
							);
						}

						const tokens = decryptTokens(
							data.encrypted_tokens,
							this.keyPair.privateKey
						);

						this.logger.debug('Successfully decrypted authentication tokens');

						return {
							token: tokens.access_token,
							refreshToken: tokens.refresh_token,
							userId: tokens.user_id,
							email: tokens.email,
							expiresAt: tokens.expires_in
								? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
								: undefined,
							tokenType: 'standard',
							savedAt: new Date().toISOString()
						};
					}

					case 'failed':
						throw new AuthenticationError(
							data.error_description || data.error || 'Authentication failed',
							'OAUTH_FAILED'
						);

					case 'expired':
						throw new AuthenticationError(
							'Authentication flow expired',
							'AUTH_TIMEOUT'
						);

					case 'pending':
					case 'authenticating':
						// Still waiting, continue polling
						this.logger.debug(
							`Flow status: ${data.status}, continuing to poll`
						);
						break;

					default:
						this.logger.warn(`Unknown flow status: ${data.status}`);
				}
			} catch (error) {
				if (error instanceof AuthenticationError) {
					throw error;
				}

				// Log network errors but continue polling
				this.logger.debug('Poll request failed, will retry:', error);
			}

			// Wait before next poll
			await new Promise((resolve) => setTimeout(resolve, pollInterval));
		}

		throw new AuthenticationError('Authentication timeout', 'AUTH_TIMEOUT');
	}

	/**
	 * Get CLI version from centralized constants
	 */
	private getCliVersion(): string {
		return TASKMASTER_VERSION;
	}

	/**
	 * Get the authorization URL (for browser opening)
	 */
	getAuthorizationUrl(): string | null {
		return this.authorizationUrl;
	}

	/**
	 * Check if MFA is required and throw appropriate error if so
	 * This ensures OAuth flow enforces MFA when user has it enabled
	 */
	private async checkAndThrowIfMFARequired(): Promise<void> {
		const mfaCheck = await this.supabaseClient.checkMFARequired();

		if (mfaCheck.required) {
			// MFA is required - check if we have complete factor information
			if (!mfaCheck.factorId || !mfaCheck.factorType) {
				this.logger.error('MFA required but factor information is incomplete', {
					mfaCheck
				});
				throw new AuthenticationError(
					'MFA is required but the server returned incomplete factor configuration. Please contact support or try re-enrolling MFA.',
					'MFA_REQUIRED_INCOMPLETE'
				);
			}

			this.logger.info('MFA verification required after OAuth login', {
				factorId: mfaCheck.factorId,
				factorType: mfaCheck.factorType
			});

			const mfaChallenge: MFAChallenge = {
				factorId: mfaCheck.factorId,
				factorType: mfaCheck.factorType
			};

			throw new AuthenticationError(
				'MFA verification required. Please provide your authentication code.',
				'MFA_REQUIRED',
				undefined,
				mfaChallenge
			);
		}
	}
}
