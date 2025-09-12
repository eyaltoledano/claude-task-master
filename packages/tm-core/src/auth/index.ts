/**
 * Authentication module exports
 */

export { AuthManager } from './auth-manager.js';
export { CredentialStore } from './credential-store.js';
export { OAuthService } from './oauth-service.js';
export { SupabaseSessionStorage } from './supabase-session-storage.js';
export type {
	Organization,
	Brief,
	RemoteTask
} from '../services/organization.service.js';

export type {
	AuthCredentials,
	OAuthFlowOptions,
	AuthConfig,
	CliData,
	UserContext
} from './types.js';

export { AuthenticationError } from './types.js';

export {
	DEFAULT_AUTH_CONFIG,
	getAuthConfig
} from './config.js';
