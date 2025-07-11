/**
 * Hook Validator - validates hook structure and security
 */
export class HookValidator {
	constructor(options = {}) {
		this.strictMode = options.strictMode || false;
		this.allowedMethods = new Set([
			'onPreLaunch',
			'onPostWorktree',
			'onPreResearch',
			'onPostResearch',
			'onPreClaudeMd',
			'onPostClaudeMd',
			'onSessionStarted',
			'onSessionMessage',
			'onSessionCompleted',
			'onPrePr',
			'onPrCreated',
			'onSessionFailed'
		]);

		this.requiredProperties = ['events'];
		this.optionalProperties = [
			'version',
			'description',
			'timeout',
			'timeouts',
			'config'
		];
		this.dangerousPatterns = [
			/eval\s*\(/,
			/Function\s*\(/,
			/require\s*\(/,
			/import\s*\(/,
			/process\.exit/,
			/process\.kill/,
			/child_process/,
			/fs\.unlink/,
			/fs\.rmdir/,
			/rm\s+-rf/
		];
	}

	/**
	 * Validate a hook instance
	 */
	async validateHook(hookInstance) {
		const errors = [];
		const warnings = [];

		try {
			// Basic structure validation
			this.validateStructure(hookInstance, errors, warnings);

			// Security validation
			this.validateSecurity(hookInstance, errors, warnings);

			// Method validation
			this.validateMethods(hookInstance, errors, warnings);

			// Configuration validation
			this.validateConfiguration(hookInstance, errors, warnings);
		} catch (validationError) {
			errors.push(`Validation failed: ${validationError.message}`);
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
			strictMode: this.strictMode
		};
	}

	/**
	 * Validate basic hook structure
	 */
	validateStructure(hookInstance, errors, warnings) {
		// Check if it's an object
		if (!hookInstance || typeof hookInstance !== 'object') {
			errors.push('Hook must be an object');
			return;
		}

		// Check required properties
		for (const prop of this.requiredProperties) {
			if (!(prop in hookInstance)) {
				errors.push(`Missing required property: ${prop}`);
			}
		}

		// Validate events property
		if (hookInstance.events) {
			if (!Array.isArray(hookInstance.events)) {
				errors.push('events property must be an array');
			} else if (hookInstance.events.length === 0) {
				warnings.push('Hook declares no events');
			} else {
				// Validate event names
				for (const event of hookInstance.events) {
					if (typeof event !== 'string') {
						errors.push(`Invalid event type: ${typeof event}`);
					} else if (!this.isValidEventName(event)) {
						warnings.push(`Unknown event: ${event}`);
					}
				}
			}
		}

		// Check for unexpected properties in strict mode
		if (this.strictMode) {
			const allowedProps = new Set([
				...this.requiredProperties,
				...this.optionalProperties
			]);
			for (const prop in hookInstance) {
				if (
					!allowedProps.has(prop) &&
					!prop.startsWith('on') &&
					prop !== 'constructor'
				) {
					warnings.push(`Unexpected property: ${prop}`);
				}
			}
		}
	}

	/**
	 * Validate hook security
	 */
	validateSecurity(hookInstance, errors, warnings) {
		// Convert hook to string for pattern matching
		const hookString = this.hookToString(hookInstance);

		// Check for dangerous patterns
		for (const pattern of this.dangerousPatterns) {
			if (pattern.test(hookString)) {
				errors.push(
					`Potentially dangerous pattern detected: ${pattern.source}`
				);
			}
		}

		// Check for prototype pollution attempts
		if (hookString.includes('__proto__') || hookString.includes('prototype')) {
			warnings.push('Prototype manipulation detected - review carefully');
		}

		// Check for network access attempts
		if (
			hookString.includes('fetch') ||
			hookString.includes('XMLHttpRequest') ||
			hookString.includes('axios')
		) {
			warnings.push('Network access detected - ensure this is intentional');
		}
	}

	/**
	 * Validate hook methods
	 */
	validateMethods(hookInstance, errors, warnings) {
		// Check that declared events have corresponding methods
		if (hookInstance.events) {
			for (const event of hookInstance.events) {
				const methodName = this.eventToMethodName(event);

				if (!(methodName in hookInstance)) {
					errors.push(`Missing method ${methodName} for event ${event}`);
				} else if (typeof hookInstance[methodName] !== 'function') {
					errors.push(`${methodName} must be a function`);
				}
			}
		}

		// Check for methods that don't correspond to declared events
		for (const prop in hookInstance) {
			if (prop.startsWith('on') && typeof hookInstance[prop] === 'function') {
				const event = this.methodNameToEvent(prop);
				if (hookInstance.events && !hookInstance.events.includes(event)) {
					warnings.push(`Method ${prop} found but event ${event} not declared`);
				}
			}
		}
	}

	/**
	 * Validate hook configuration
	 */
	validateConfiguration(hookInstance, errors, warnings) {
		// Validate timeout settings
		if (hookInstance.timeout !== undefined) {
			if (
				typeof hookInstance.timeout !== 'number' ||
				hookInstance.timeout <= 0
			) {
				errors.push('timeout must be a positive number');
			} else if (hookInstance.timeout > 300000) {
				// 5 minutes
				warnings.push('timeout is very long (>5 minutes)');
			}
		}

		// Validate timeouts object
		if (hookInstance.timeouts) {
			if (typeof hookInstance.timeouts !== 'object') {
				errors.push('timeouts must be an object');
			} else {
				for (const [event, timeout] of Object.entries(hookInstance.timeouts)) {
					if (typeof timeout !== 'number' || timeout <= 0) {
						errors.push(`Invalid timeout for event ${event}`);
					}
				}
			}
		}

		// Validate version
		if (hookInstance.version !== undefined) {
			if (typeof hookInstance.version !== 'string') {
				errors.push('version must be a string');
			} else if (!/^\d+\.\d+\.\d+/.test(hookInstance.version)) {
				warnings.push('version should follow semantic versioning (x.y.z)');
			}
		}
	}

	/**
	 * Convert hook instance to string for analysis
	 */
	hookToString(hookInstance) {
		try {
			const methods = {};
			for (const prop in hookInstance) {
				if (typeof hookInstance[prop] === 'function') {
					methods[prop] = hookInstance[prop].toString();
				}
			}
			return JSON.stringify(methods);
		} catch (error) {
			return '';
		}
	}

	/**
	 * Convert event name to method name
	 */
	eventToMethodName(event) {
		const camelCase = event.replace(/-([a-z])/g, (match, letter) =>
			letter.toUpperCase()
		);
		return `on${camelCase.charAt(0).toUpperCase()}${camelCase.slice(1)}`;
	}

	/**
	 * Convert method name to event name
	 */
	methodNameToEvent(methodName) {
		if (!methodName.startsWith('on')) return methodName;

		const withoutOn = methodName.slice(2);
		return withoutOn
			.replace(/([A-Z])/g, (match, letter) => `-${letter.toLowerCase()}`)
			.slice(1);
	}

	/**
	 * Check if event name is valid
	 */
	isValidEventName(event) {
		const validEvents = [
			'pre-launch',
			'post-worktree',
			'pre-research',
			'post-research',
			'pre-claude-md',
			'post-claude-md',
			'session-started',
			'session-message',
			'session-completed',
			'pre-pr',
			'pr-created',
			'session-failed'
		];

		return validEvents.includes(event);
	}

	/**
	 * Set strict mode
	 */
	setStrictMode(enabled) {
		this.strictMode = enabled;
	}
}
