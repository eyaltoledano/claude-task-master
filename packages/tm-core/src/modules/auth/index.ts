/**
 * Authentication module exports
 */

export { AuthDomain, type StorageDisplayInfo } from './auth-domain.js';
export { AuthManager } from './managers/auth-manager.js';
export { ContextStore, type StoredContext } from './services/context-store.js';
export { OAuthService } from './services/oauth-service.js';
export { SupabaseSessionStorage } from './services/supabase-session-storage.js';
export type {
	Organization,
	RemoteTask
} from './services/organization.service.js';

export type {
	AuthCredentials,
	OAuthFlowOptions,
	AuthConfig,
	CliData,
	UserContext,
	MFAVerificationResult
} from './types.js';

export { AuthenticationError } from './types.js';

export {
	DEFAULT_AUTH_CONFIG,
	getAuthConfig
} from './config.js';

// Command guard types and utilities
export { isLocalOnlyCommand, type AuthBlockResult } from './command.guard.js';

// Auth constants
export {
	AUTH_TIMEOUT_MS,
	MFA_MAX_ATTEMPTS,
	LOCAL_ONLY_COMMANDS,
	type LocalOnlyCommand
} from './constants.js';
