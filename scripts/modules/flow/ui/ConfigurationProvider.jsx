import React, {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect
} from 'react';

const ConfigurationContext = createContext();

export const useConfiguration = () => {
	const context = useContext(ConfigurationContext);
	if (!context) {
		throw new Error(
			'useConfiguration must be used within ConfigurationProvider'
		);
	}
	return context;
};

export const ConfigurationProvider = ({ children, backend }) => {
	const [config, setConfig] = useState(null);
	const [originalConfig, setOriginalConfig] = useState(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [validationErrors, setValidationErrors] = useState({});

	// Load configuration from backend
	const loadConfiguration = useCallback(async () => {
		try {
			setLoading(true);
			const configuration = await backend.getConfiguration();
			setConfig(configuration);
			setOriginalConfig(JSON.parse(JSON.stringify(configuration))); // Deep copy
			setHasChanges(false);
			setValidationErrors({});
		} catch (error) {
			console.error('Failed to load configuration:', error);
		} finally {
			setLoading(false);
		}
	}, [backend]);

	// Update a specific configuration field
	const updateConfig = useCallback((path, value) => {
		setConfig((prevConfig) => {
			const newConfig = { ...prevConfig };
			const keys = path.split('.');
			let current = newConfig;

			// Navigate to the parent of the target key
			for (let i = 0; i < keys.length - 1; i++) {
				if (!current[keys[i]]) {
					current[keys[i]] = {};
				}
				current = current[keys[i]];
			}

			// Set the value
			current[keys[keys.length - 1]] = value;

			return newConfig;
		});

		setHasChanges(true);
	}, []);

	// Validate configuration
	const validateConfig = useCallback(
		(configToValidate = config) => {
			const errors = {};

			// Validate auto-merge settings
			if (configToValidate?.autoMerge?.recentActivityWindow) {
				const timePattern = /^\d+\s+(minutes?|hours?|days?)\s+ago$/;
				if (
					!timePattern.test(configToValidate.autoMerge.recentActivityWindow)
				) {
					errors['autoMerge.recentActivityWindow'] =
						'Invalid time format. Use format like "30 minutes ago"';
				}
			}

			// Validate retry settings
			if (configToValidate?.autoMerge?.maxRetries) {
				const retries = parseInt(configToValidate.autoMerge.maxRetries);
				if (Number.isNaN(retries) || retries < 0 || retries > 10) {
					errors['autoMerge.maxRetries'] =
						'Max retries must be between 0 and 10';
				}
			}

			// Validate retry delay
			if (configToValidate?.autoMerge?.retryDelay) {
				const delay = parseInt(configToValidate.autoMerge.retryDelay);
				if (Number.isNaN(delay) || delay < 1000 || delay > 300000) {
					errors['autoMerge.retryDelay'] =
						'Retry delay must be between 1000ms and 300000ms';
				}
			}

			setValidationErrors(errors);
			return Object.keys(errors).length === 0;
		},
		[config]
	);

	// Save configuration
	const saveConfiguration = useCallback(async () => {
		if (!validateConfig()) {
			return false;
		}

		try {
			setSaving(true);
			await backend.updateConfiguration(config);
			setOriginalConfig(JSON.parse(JSON.stringify(config)));
			setHasChanges(false);
			return true;
		} catch (error) {
			console.error('Failed to save configuration:', error);
			return false;
		} finally {
			setSaving(false);
		}
	}, [backend, config, validateConfig]);

	// Reset to original configuration
	const resetConfiguration = useCallback(() => {
		if (originalConfig) {
			setConfig(JSON.parse(JSON.stringify(originalConfig)));
			setHasChanges(false);
			setValidationErrors({});
		}
	}, [originalConfig]);

	// Get configuration value by path
	const getConfigValue = useCallback(
		(path, defaultValue = undefined) => {
			if (!config) return defaultValue;

			const keys = path.split('.');
			let current = config;

			for (const key of keys) {
				if (
					current === null ||
					current === undefined ||
					!current.hasOwnProperty(key)
				) {
					return defaultValue;
				}
				current = current[key];
			}

			return current;
		},
		[config]
	);

	// Check if a specific field has validation errors
	const hasError = useCallback(
		(path) => {
			return validationErrors.hasOwnProperty(path);
		},
		[validationErrors]
	);

	// Get error message for a specific field
	const getError = useCallback(
		(path) => {
			return validationErrors[path];
		},
		[validationErrors]
	);

	// Load configuration on mount
	useEffect(() => {
		loadConfiguration();
	}, [loadConfiguration]);

	const value = {
		// State
		config,
		loading,
		saving,
		hasChanges,
		validationErrors,

		// Actions
		updateConfig,
		saveConfiguration,
		resetConfiguration,
		loadConfiguration,
		validateConfig,

		// Helpers
		getConfigValue,
		hasError,
		getError
	};

	return (
		<ConfigurationContext.Provider value={value}>
			{children}
		</ConfigurationContext.Provider>
	);
};
