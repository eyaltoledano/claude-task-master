/**
 * @fileoverview Custom error types for the Profile system
 */

/**
 * Base error class for all profile-related errors
 */
export class ProfileError extends Error {
	/**
	 * @param {string} message - Error message
	 * @param {string} [profileName] - Name of the profile that caused the error
	 * @param {Error} [cause] - Original error that caused this error
	 */
	constructor(message, profileName = null, cause = null) {
		super(message);
		this.name = 'ProfileError';
		this.profileName = profileName;
		this.cause = cause;
		
		// Maintain proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ProfileError);
		}
	}
}

/**
 * Error thrown when profile validation fails
 */
export class ProfileValidationError extends ProfileError {
	/**
	 * @param {string} message - Validation error message
	 * @param {string} field - Field that failed validation
	 * @param {string} [profileName] - Name of the profile
	 */
	constructor(message, field, profileName = null) {
		super(message, profileName);
		this.name = 'ProfileValidationError';
		this.field = field;
	}
}

/**
 * Error thrown when a profile is not found
 */
export class ProfileNotFoundError extends ProfileError {
	/**
	 * @param {string} profileName - Name of the profile that was not found
	 * @param {string[]} [availableProfiles] - List of available profile names
	 */
	constructor(profileName, availableProfiles = []) {
		const message = availableProfiles.length > 0
			? `Profile '${profileName}' not found. Available profiles: ${availableProfiles.join(', ')}`
			: `Profile '${profileName}' not found`;
		super(message, profileName);
		this.name = 'ProfileNotFoundError';
		this.availableProfiles = availableProfiles;
	}
}

/**
 * Error thrown when attempting to register a duplicate profile
 */
export class ProfileRegistrationError extends ProfileError {
	/**
	 * @param {string} profileName - Name of the profile that caused the conflict
	 * @param {string} reason - Reason for the registration failure
	 */
	constructor(profileName, reason = 'Profile already registered') {
		super(`Failed to register profile '${profileName}': ${reason}`, profileName);
		this.name = 'ProfileRegistrationError';
	}
}

/**
 * Error thrown during profile lifecycle operations (install, remove, etc.)
 */
export class ProfileOperationError extends ProfileError {
	/**
	 * @param {string} operation - Operation that failed ('install', 'remove', 'convert')
	 * @param {string} profileName - Name of the profile
	 * @param {string} message - Error message
	 * @param {Error} [cause] - Original error that caused this error
	 */
	constructor(operation, profileName, message, cause = null) {
		const fullMessage = `Profile ${operation} failed for '${profileName}': ${message}`;
		super(fullMessage, profileName, cause);
		this.name = 'ProfileOperationError';
		this.operation = operation;
	}
} 