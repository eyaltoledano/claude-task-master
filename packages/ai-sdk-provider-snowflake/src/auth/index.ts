/**
 * Authentication module exports
 */

export {
	authenticate,
	resolveConnectionConfig,
	generateJwtToken,
	clearAuthCache,
	validateCredentials
} from './snowflake-auth.js';

export { TokenCache, defaultTokenCache } from './token-cache.js';
