/**
 * Authentication module exports
 */

export { AuthManager } from './auth-manager.js';
export { CredentialStore } from './credential-store.js';
export { OAuthService } from './oauth-service.js';

export type {
	AuthCredentials,
	OAuthFlowOptions,
	AuthConfig,
	CliData
} from './types.js';

export { AuthenticationError } from './types.js';

export {
	DEFAULT_AUTH_CONFIG,
	getAuthConfig
} from './config.js';
