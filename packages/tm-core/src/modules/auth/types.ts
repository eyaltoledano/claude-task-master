/**
 * Authentication types and interfaces
 */

export interface AuthCredentials {
	token: string;
	refreshToken?: string;
	userId: string;
	email?: string;
	expiresAt?: string | number;
	tokenType?: 'standard';
	savedAt: string;
	selectedContext?: UserContext;
}

export interface UserContext {
	orgId?: string;
	orgName?: string;
	orgSlug?: string;
	briefId?: string;
	briefName?: string;
	briefStatus?: string;
	briefUpdatedAt?: string;
	updatedAt: string;
}

/**
 * User context with a guaranteed briefId
 */
export type UserContextWithBrief = UserContext & { briefId: string };

export interface OAuthFlowOptions {
	/** Callback to open the browser with the auth URL. If not provided, browser won't be opened */
	openBrowser?: (url: string) => Promise<void>;
	/** Timeout for the OAuth flow in milliseconds. Default: 300000 (5 minutes) */
	timeout?: number;
	/** Callback to be invoked with the authorization URL */
	onAuthUrl?: (url: string) => void;
	/** Callback to be invoked when waiting for authentication */
	onWaitingForAuth?: () => void;
	/** Callback to be invoked on successful authentication */
	onSuccess?: (credentials: AuthCredentials) => void;
	/** Callback to be invoked on authentication error */
	onError?: (error: AuthenticationError) => void;
}

export interface AuthConfig {
	baseUrl: string;
	configDir: string;
	configFile: string;
}

export interface CliData {
	callback: string;
	state: string;
	name: string;
	version: string;
	device?: string;
	user?: string;
	platform?: string;
	timestamp?: number;
}

/**
 * MFA challenge information
 */
export interface MFAChallenge {
	/** ID of the MFA factor that needs verification */
	factorId: string;
	/** Type of MFA factor (e.g., 'totp') */
	factorType: string;
}

/**
 * Result of MFA verification with retry
 */
export interface MFAVerificationResult {
	/** Whether verification was successful */
	success: boolean;
	/** Number of attempts used */
	attemptsUsed: number;
	/** Credentials if successful */
	credentials?: AuthCredentials;
	/** Error code if failed */
	errorCode?: AuthErrorCode;
}

/**
 * Authentication error codes
 */
export type AuthErrorCode =
	| 'AUTH_TIMEOUT'
	| 'AUTH_EXPIRED'
	| 'OAUTH_FAILED'
	| 'OAUTH_ERROR'
	| 'OAUTH_CANCELED'
	| 'URL_GENERATION_FAILED'
	| 'INVALID_STATE'
	| 'NO_TOKEN'
	| 'TOKEN_EXCHANGE_FAILED'
	| 'INVALID_CREDENTIALS'
	| 'NO_REFRESH_TOKEN'
	| 'NOT_AUTHENTICATED'
	| 'NETWORK_ERROR'
	| 'CONFIG_MISSING'
	| 'SAVE_FAILED'
	| 'CLEAR_FAILED'
	| 'STORAGE_ERROR'
	| 'NOT_SUPPORTED'
	| 'REFRESH_FAILED'
	| 'INVALID_RESPONSE'
	| 'PKCE_INIT_FAILED'
	| 'PKCE_FAILED'
	| 'CODE_EXCHANGE_FAILED'
	| 'SESSION_SET_FAILED'
	| 'CODE_AUTH_FAILED'
	| 'INVALID_CODE'
	| 'MFA_REQUIRED'
	| 'MFA_REQUIRED_INCOMPLETE'
	| 'MFA_VERIFICATION_FAILED'
	| 'INVALID_MFA_CODE';

/**
 * Authentication error class
 */
export class AuthenticationError extends Error {
	/** Optional MFA challenge information when MFA is required */
	public mfaChallenge?: MFAChallenge;

	constructor(
		message: string,
		public code: AuthErrorCode,
		public cause?: unknown,
		mfaChallenge?: MFAChallenge
	) {
		super(message);
		this.name = 'AuthenticationError';
		this.mfaChallenge = mfaChallenge;
		if (cause && cause instanceof Error) {
			this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
		}
	}
}
