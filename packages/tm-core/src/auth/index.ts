/**
 * Authentication module exports
 */

export { AuthManager } from './auth-manager';
export { CredentialStore } from './credential-store';
export { OAuthService } from './oauth-service';

export type {
	AuthCredentials,
	OAuthFlowOptions,
	AuthConfig,
	CliData
} from './types';

export { AuthenticationError } from './types';

export {
	DEFAULT_AUTH_CONFIG,
	getAuthConfig
} from './config';
