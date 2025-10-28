/**
 * OAuth 2.0 Authorization Code Flow service
 */

import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import os from 'os';
import {
	AuthCredentials,
	AuthenticationError,
	OAuthFlowOptions,
	AuthConfig,
	CliData
} from '../types.js';
import { ContextStore } from '../services/context-store.js';
import { SupabaseAuthClient } from '../../integration/clients/supabase-client.js';
import { getAuthConfig } from '../config.js';
import { getLogger } from '../../../common/logger/index.js';
import packageJson from '../../../../../../package.json' with { type: 'json' };
import { Session } from '@supabase/supabase-js';

export class OAuthService {
	private logger = getLogger('OAuthService');
	private contextStore: ContextStore;
	private supabaseClient: SupabaseAuthClient;
	private baseUrl: string;
	private authorizationUrl: string | null = null;
	private originalState: string | null = null;
	private authorizationReady: Promise<void> | null = null;
	private resolveAuthorizationReady: (() => void) | null = null;

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
			// Start the OAuth flow (starts local server)
			const authPromise = this.startFlow(timeout);

			// Wait for server to be ready and URL to be generated
			if (this.authorizationReady) {
				await this.authorizationReady;
			}

			// Get the authorization URL
			const authUrl = this.getAuthorizationUrl();

			if (!authUrl) {
				throw new AuthenticationError(
					'Failed to generate authorization URL',
					'URL_GENERATION_FAILED'
				);
			}

			// Notify about the auth URL
			if (onAuthUrl) {
				onAuthUrl(authUrl);
			}

			// Open browser if callback provided
			if (openBrowser) {
				try {
					await openBrowser(authUrl);
					this.logger.debug('Browser opened successfully with URL:', authUrl);
				} catch (error) {
					// Log the error but don't throw - user can still manually open the URL
					this.logger.warn('Failed to open browser automatically:', error);
				}
			}

			// Notify that we're waiting for authentication
			if (onWaitingForAuth) {
				onWaitingForAuth();
			}

			// Wait for authentication to complete
			const credentials = await authPromise;

			// Notify success
			if (onSuccess) {
				onSuccess(credentials);
			}

			return credentials;
		} catch (error) {
			const authError =
				error instanceof AuthenticationError
					? error
					: new AuthenticationError(
							`OAuth authentication failed: ${(error as Error).message}`,
							'OAUTH_FAILED',
							error
						);

			// Notify error
			if (onError) {
				onError(authError);
			}

			throw authError;
		}
	}

	/**
	 * Start the OAuth flow (internal implementation)
	 */
	private async startFlow(timeout: number = 300000): Promise<AuthCredentials> {
		const state = this.generateState();

		// Store the original state for verification
		this.originalState = state;

		// Create a promise that will resolve when the server is ready
		this.authorizationReady = new Promise<void>((resolve) => {
			this.resolveAuthorizationReady = resolve;
		});

		return new Promise((resolve, reject) => {
			let timeoutId: NodeJS.Timeout;
			// Create local HTTP server for OAuth callback
			const server = http.createServer();

			// Start server on localhost only, bind to port 0 for automatic port assignment
			server.listen(0, '127.0.0.1', () => {
				const address = server.address();
				if (!address || typeof address === 'string') {
					reject(new Error('Failed to get server address'));
					return;
				}
				const port = address.port;
				const callbackUrl = `http://localhost:${port}/callback`;

				// Set up request handler after we know the port
				server.on('request', async (req, res) => {
					const url = new URL(req.url!, `http://127.0.0.1:${port}`);

					if (url.pathname === '/callback') {
						await this.handleCallback(
							url,
							res,
							server,
							resolve,
							reject,
							timeoutId
						);
					} else {
						// Handle other paths (favicon, etc.)
						res.writeHead(404);
						res.end();
					}
				});

				// Prepare CLI data object (server handles OAuth/PKCE)
				const cliData: CliData = {
					callback: callbackUrl,
					state: state,
					name: 'Task Master CLI',
					version: this.getCliVersion(),
					device: os.hostname(),
					user: os.userInfo().username,
					platform: os.platform(),
					timestamp: Date.now()
				};

				// Build authorization URL for CLI-specific sign-in page
				const authUrl = new URL(`${this.baseUrl}/auth/cli/sign-in`);

				// Encode CLI data as base64
				const cliParam = Buffer.from(JSON.stringify(cliData)).toString(
					'base64'
				);

				// Set the single CLI parameter with all encoded data
				authUrl.searchParams.append('cli', cliParam);

				// Store auth URL for browser opening
				this.authorizationUrl = authUrl.toString();

				this.logger.info(
					`OAuth session started - ${cliData.name} v${cliData.version} on port ${port}`
				);
				this.logger.debug('CLI data:', cliData);

				// Signal that the server is ready and URL is available
				if (this.resolveAuthorizationReady) {
					this.resolveAuthorizationReady();
					this.resolveAuthorizationReady = null;
				}
			});

			// Set timeout for authentication
			timeoutId = setTimeout(() => {
				if (server.listening) {
					server.close();
					// Clean up the readiness promise if still pending
					if (this.resolveAuthorizationReady) {
						this.resolveAuthorizationReady();
						this.resolveAuthorizationReady = null;
					}
					reject(
						new AuthenticationError('Authentication timeout', 'AUTH_TIMEOUT')
					);
				}
			}, timeout);
		});
	}

	/**
	 * Handle OAuth callback
	 */
	private async handleCallback(
		url: URL,
		res: http.ServerResponse,
		server: http.Server,
		resolve: (value: AuthCredentials) => void,
		reject: (error: any) => void,
		timeoutId?: NodeJS.Timeout
	): Promise<void> {
		// Server now returns tokens directly instead of code
		const type = url.searchParams.get('type');
		const returnedState = url.searchParams.get('state');
		const accessToken = url.searchParams.get('access_token');
		const refreshToken = url.searchParams.get('refresh_token');
		const expiresIn = url.searchParams.get('expires_in');
		const error = url.searchParams.get('error');
		const errorDescription = url.searchParams.get('error_description');

		// Server handles displaying success/failure, just close connection
		res.writeHead(200);
		res.end();

		if (error) {
			if (server.listening) {
				server.close();
			}
			reject(
				new AuthenticationError(
					errorDescription || error || 'Authentication failed',
					'OAUTH_ERROR'
				)
			);
			return;
		}

		// Verify state parameter for CSRF protection
		if (returnedState !== this.originalState) {
			if (server.listening) {
				server.close();
			}
			reject(
				new AuthenticationError('Invalid state parameter', 'INVALID_STATE')
			);
			return;
		}

		// Handle authorization code for PKCE flow
		const code = url.searchParams.get('code');
		this.logger.info(`Code: ${code}, type: ${type}`);
		if (code && type === 'pkce_callback') {
			try {
				this.logger.info('Received authorization code for PKCE flow');

				const session = await this.supabaseClient.exchangeCodeForSession(code);

				// Save user info to context store
				this.contextStore.saveContext({
					userId: session.user.id,
					email: session.user.email
				});

				// Calculate expiration - can be overridden with TM_TOKEN_EXPIRY_MINUTES
				let expiresAt: string | undefined;
				const tokenExpiryMinutes = process.env.TM_TOKEN_EXPIRY_MINUTES;
				if (tokenExpiryMinutes) {
					const minutes = parseInt(tokenExpiryMinutes);
					expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
					this.logger.warn(`Token expiry overridden to ${minutes} minute(s)`);
				} else {
					expiresAt = session.expires_at
						? new Date(session.expires_at * 1000).toISOString()
						: undefined;
				}

				// Return credentials for backward compatibility
				const authData: AuthCredentials = {
					token: session.access_token,
					refreshToken: session.refresh_token,
					userId: session.user.id,
					email: session.user.email,
					expiresAt,
					tokenType: 'standard',
					savedAt: new Date().toISOString()
				};

				if (server.listening) {
					server.close();
				}
				// Clear timeout since authentication succeeded
				if (timeoutId) {
					clearTimeout(timeoutId);
				}
				resolve(authData);
				return;
			} catch (error) {
				if (server.listening) {
					server.close();
				}
				reject(error);
				return;
			}
		}

		// Handle direct token response from server (legacy flow)
		if (
			accessToken &&
			(type === 'oauth_success' || type === 'session_transfer')
		) {
			try {
				this.logger.info(
					`\n\n==============================================\n Received tokens via ${type}\n==============================================\n`
				);

				// Create a session with the tokens and set it in Supabase client
				// This automatically saves the session to session.json via SupabaseSessionStorage
				const session: Session = {
					access_token: accessToken,
					refresh_token: refreshToken || '',
					expires_in: expiresIn ? parseInt(expiresIn) : 0,
					token_type: 'bearer',
					user: null as any // Will be populated by setSession
				};

				// Set the session in Supabase client
				await this.supabaseClient.setSession(session);

				// Get user info from the session
				const user = await this.supabaseClient.getUser();

				// Save user info to context store
				this.contextStore.saveContext({
					userId: user?.id || 'unknown',
					email: user?.email
				});

				// Calculate expiration time - can be overridden with TM_TOKEN_EXPIRY_MINUTES
				let expiresAt: string | undefined;
				const tokenExpiryMinutes = process.env.TM_TOKEN_EXPIRY_MINUTES;
				if (tokenExpiryMinutes) {
					const minutes = parseInt(tokenExpiryMinutes);
					expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
					this.logger.warn(`Token expiry overridden to ${minutes} minute(s)`);
				} else {
					expiresAt = expiresIn
						? new Date(Date.now() + parseInt(expiresIn) * 1000).toISOString()
						: undefined;
				}

				// Return credentials for backward compatibility
				const authData: AuthCredentials = {
					token: accessToken,
					refreshToken: refreshToken || undefined,
					userId: user?.id || 'unknown',
					email: user?.email,
					expiresAt,
					tokenType: 'standard',
					savedAt: new Date().toISOString()
				};

				if (server.listening) {
					server.close();
				}
				// Clear timeout since authentication succeeded
				if (timeoutId) {
					clearTimeout(timeoutId);
				}
				resolve(authData);
			} catch (error) {
				if (server.listening) {
					server.close();
				}
				reject(error);
			}
		} else {
			if (server.listening) {
				server.close();
			}
			reject(new AuthenticationError('No access token received', 'NO_TOKEN'));
		}
	}

	/**
	 * Generate state for OAuth flow
	 */
	private generateState(): string {
		return crypto.randomBytes(32).toString('base64url');
	}

	/**
	 * Get CLI version from package.json if available
	 */
	private getCliVersion(): string {
		return packageJson.version || 'unknown';
	}

	/**
	 * Get the authorization URL (for browser opening)
	 */
	getAuthorizationUrl(): string | null {
		return this.authorizationUrl;
	}
}
