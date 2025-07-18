/**
 * @fileoverview Profile system core exports
 * Central export point for the new profile system
 */

// Core profile system exports
export { default as Profile } from './Profile.js';
export { ProfileBuilder } from './ProfileBuilder.js';
export { ProfileRegistry } from './ProfileRegistry.js';
export {
	ProfileError,
	ProfileValidationError,
	ProfileNotFoundError,
	ProfileRegistrationError,
	ProfileOperationError
} from './ProfileError.js';

// Type definitions are available via JSDoc imports:
// import('./types.js')
