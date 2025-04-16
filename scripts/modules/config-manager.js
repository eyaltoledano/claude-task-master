import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Calculate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load supported models from JSON file using the calculated __dirname
let MODEL_MAP;
try {
	const supportedModelsRaw = fs.readFileSync(
		path.join(__dirname, 'supported-models.json'),
		'utf-8'
	);
	MODEL_MAP = JSON.parse(supportedModelsRaw);
} catch (error) {
	console.error(
		chalk.red(
			'FATAL ERROR: Could not load supported-models.json. Please ensure the file exists and is valid JSON.'
		),
		error
	);
	MODEL_MAP = {}; // Default to empty map on error to avoid crashing, though functionality will be limited
	process.exit(1); // Exit if models can't be loaded
}

const CONFIG_FILE_NAME = '.taskmasterconfig';

// Default configuration
const DEFAULT_MAIN_PROVIDER = 'anthropic';
const DEFAULT_MAIN_MODEL_ID = 'claude-3.7-sonnet-20250219';
const DEFAULT_RESEARCH_PROVIDER = 'perplexity';
const DEFAULT_RESEARCH_MODEL_ID = 'sonar-pro';

// Define ONE list of all supported providers
const VALID_PROVIDERS = [
	'anthropic',
	'openai',
	'google',
	'perplexity',
	'ollama',
	'openrouter',
	'grok'
];

let projectRoot = null;

function findProjectRoot() {
	// Keep this function as is for CLI context
	if (projectRoot) return projectRoot;

	let currentDir = process.cwd();
	while (currentDir !== path.parse(currentDir).root) {
		if (fs.existsSync(path.join(currentDir, 'package.json'))) {
			projectRoot = currentDir;
			return projectRoot;
		}
		currentDir = path.dirname(currentDir);
	}

	// Check root directory as a last resort
	if (fs.existsSync(path.join(currentDir, 'package.json'))) {
		projectRoot = currentDir;
		return projectRoot;
	}

	// If still not found, maybe look for other markers or return null
	// For now, returning null if package.json isn't found up to the root
	projectRoot = null;
	return null;
}

function readConfig(explicitRoot = null) {
	// Determine the root path to use
	const rootToUse = explicitRoot || findProjectRoot();

	const defaults = {
		models: {
			main: { provider: DEFAULT_MAIN_PROVIDER, modelId: DEFAULT_MAIN_MODEL_ID },
			research: {
				provider: DEFAULT_RESEARCH_PROVIDER,
				modelId: DEFAULT_RESEARCH_MODEL_ID
			}
		}
	};

	if (!rootToUse) {
		console.warn(
			chalk.yellow(
				'Warning: Could not determine project root. Using default configuration.'
			)
		);
		return defaults;
	}
	const configPath = path.join(rootToUse, CONFIG_FILE_NAME);

	if (fs.existsSync(configPath)) {
		try {
			const rawData = fs.readFileSync(configPath, 'utf-8');
			const parsedConfig = JSON.parse(rawData);

			// Deep merge defaults to ensure structure and handle partial configs
			const config = {
				models: {
					main: {
						provider:
							parsedConfig?.models?.main?.provider ??
							defaults.models.main.provider,
						modelId:
							parsedConfig?.models?.main?.modelId ??
							defaults.models.main.modelId
					},
					research: {
						provider:
							parsedConfig?.models?.research?.provider ??
							defaults.models.research.provider,
						modelId:
							parsedConfig?.models?.research?.modelId ??
							defaults.models.research.modelId
					},
					// Add merge logic for the fallback model
					fallback: {
						provider: parsedConfig?.models?.fallback?.provider,
						modelId: parsedConfig?.models?.fallback?.modelId
					}
				}
			};

			// Validate loaded providers (main, research, and fallback if it exists)
			if (!validateProvider(config.models.main.provider)) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid main provider "${config.models.main.provider}" in ${CONFIG_FILE_NAME}. Falling back to default.`
					)
				);
				config.models.main = {
					provider: defaults.models.main.provider,
					modelId: defaults.models.main.modelId
				};
			}
			// Optional: Add warning for model combination if desired, but don't block
			// else if (!validateProviderModelCombination(config.models.main.provider, config.models.main.modelId)) { ... }

			if (!validateProvider(config.models.research.provider)) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid research provider "${config.models.research.provider}" in ${CONFIG_FILE_NAME}. Falling back to default.`
					)
				);
				config.models.research = {
					provider: defaults.models.research.provider,
					modelId: defaults.models.research.modelId
				};
			}
			// Optional: Add warning for model combination if desired, but don't block
			// else if (!validateProviderModelCombination(config.models.research.provider, config.models.research.modelId)) { ... }

			// Add validation for fallback provider if it exists
			if (
				config.models.fallback &&
				config.models.fallback.provider &&
				!validateProvider(config.models.fallback.provider)
			) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid fallback provider "${config.models.fallback.provider}" in ${CONFIG_FILE_NAME}. Fallback model will be ignored.`
					)
				);
				// Unlike main/research, we don't set a default fallback, just ignore it
				delete config.models.fallback;
			}

			return config;
		} catch (error) {
			console.error(
				chalk.red(
					`Error reading or parsing ${configPath}: ${error.message}. Using default configuration.`
				)
			);
			return defaults;
		}
	} else {
		return defaults;
	}
}

/**
 * Validates if a provider name is in the list of supported providers.
 * @param {string} providerName The name of the provider.
 * @returns {boolean} True if the provider is valid, false otherwise.
 */
function validateProvider(providerName) {
	return VALID_PROVIDERS.includes(providerName);
}

/**
 * Optional: Validates if a modelId is known for a given provider based on MODEL_MAP.
 * This is a non-strict validation; an unknown model might still be valid.
 * @param {string} providerName The name of the provider.
 * @param {string} modelId The model ID.
 * @returns {boolean} True if the modelId is in the map for the provider, false otherwise.
 */
function validateProviderModelCombination(providerName, modelId) {
	// If provider isn't even in our map, we can't validate the model
	if (!MODEL_MAP[providerName]) {
		return true; // Allow unknown providers or those without specific model lists
	}
	// If the provider is known, check if the model is in its list OR if the list is empty (meaning accept any)
	return (
		MODEL_MAP[providerName].length === 0 ||
		// Use .some() to check the 'id' property of objects in the array
		MODEL_MAP[providerName].some((modelObj) => modelObj.id === modelId)
	);
}

/**
 * Gets the currently configured main AI provider.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string} The name of the main provider.
 */
function getMainProvider(explicitRoot = null) {
	const config = readConfig(explicitRoot);
	return config.models.main.provider;
}

/**
 * Gets the currently configured main AI model ID.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string} The ID of the main model.
 */
function getMainModelId(explicitRoot = null) {
	const config = readConfig(explicitRoot);
	return config.models.main.modelId;
}

/**
 * Gets the currently configured research AI provider.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string} The name of the research provider.
 */
function getResearchProvider(explicitRoot = null) {
	const config = readConfig(explicitRoot);
	return config.models.research.provider;
}

/**
 * Gets the currently configured research AI model ID.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string} The ID of the research model.
 */
function getResearchModelId(explicitRoot = null) {
	const config = readConfig(explicitRoot);
	return config.models.research.modelId;
}

/**
 * Gets the currently configured fallback AI provider.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string|undefined} The name of the fallback provider, or undefined if not set.
 */
function getFallbackProvider(explicitRoot = null) {
	const config = readConfig(explicitRoot);
	return config.models?.fallback?.provider;
}

/**
 * Gets the currently configured fallback AI model ID.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string|undefined} The ID of the fallback model, or undefined if not set.
 */
function getFallbackModelId(explicitRoot = null) {
	const config = readConfig(explicitRoot);
	return config.models?.fallback?.modelId;
}

/**
 * Sets the main AI model (provider and modelId) in the configuration file.
 * @param {string} providerName The name of the provider to set.
 * @param {string} modelId The ID of the model to set.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {boolean} True if successful, false otherwise.
 */
function setMainModel(providerName, modelId, explicitRoot = null) {
	// --- 1. Validate Provider First ---
	if (!validateProvider(providerName)) {
		console.error(
			chalk.red(`Error: "${providerName}" is not a valid provider.`)
		);
		console.log(
			chalk.yellow(`Available providers: ${VALID_PROVIDERS.join(', ')}`)
		);
		return false;
	}

	// --- 2. Validate Role Second ---
	const allModels = getAvailableModels(); // Get all models to check roles
	const modelData = allModels.find(
		(m) => m.id === modelId && m.provider === providerName
	);

	if (
		!modelData ||
		!modelData.allowed_roles ||
		!modelData.allowed_roles.includes('main')
	) {
		console.error(
			chalk.red(`Error: Model "${modelId}" is not allowed for the 'main' role.`)
		);
		// Try to suggest valid models for the role
		const allowedMainModels = allModels
			.filter((m) => m.allowed_roles?.includes('main'))
			.map((m) => `  - ${m.provider} / ${m.id}`)
			.join('\n');
		if (allowedMainModels) {
			console.log(
				chalk.yellow('\nAllowed models for main role:\n' + allowedMainModels)
			);
		}
		return false;
	}

	// --- 3. Validate Model Combination (Optional Warning) ---
	if (!validateProviderModelCombination(providerName, modelId)) {
		console.warn(
			chalk.yellow(
				`Warning: Model "${modelId}" is not in the known list for provider "${providerName}". Ensure it is valid.`
			)
		);
	}

	// --- Proceed with setting ---
	const config = readConfig(explicitRoot);
	config.models.main = { provider: providerName, modelId: modelId };
	// Pass explicitRoot down
	if (writeConfig(config, explicitRoot)) {
		console.log(
			chalk.green(`Main AI model set to: ${providerName} / ${modelId}`)
		);
		return true;
	} else {
		return false;
	}
}

/**
 * Sets the research AI model (provider and modelId) in the configuration file.
 * @param {string} providerName The name of the provider to set.
 * @param {string} modelId The ID of the model to set.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {boolean} True if successful, false otherwise.
 */
function setResearchModel(providerName, modelId, explicitRoot = null) {
	// --- 1. Validate Provider First ---
	if (!validateProvider(providerName)) {
		console.error(
			chalk.red(`Error: "${providerName}" is not a valid provider.`)
		);
		console.log(
			chalk.yellow(`Available providers: ${VALID_PROVIDERS.join(', ')}`)
		);
		return false;
	}

	// --- 2. Validate Role Second ---
	const allModels = getAvailableModels(); // Get all models to check roles
	const modelData = allModels.find(
		(m) => m.id === modelId && m.provider === providerName
	);

	if (
		!modelData ||
		!modelData.allowed_roles ||
		!modelData.allowed_roles.includes('research')
	) {
		console.error(
			chalk.red(
				`Error: Model "${modelId}" is not allowed for the 'research' role.`
			)
		);
		// Try to suggest valid models for the role
		const allowedResearchModels = allModels
			.filter((m) => m.allowed_roles?.includes('research'))
			.map((m) => `  - ${m.provider} / ${m.id}`)
			.join('\n');
		if (allowedResearchModels) {
			console.log(
				chalk.yellow(
					'\nAllowed models for research role:\n' + allowedResearchModels
				)
			);
		}
		return false;
	}

	// --- 3. Validate Model Combination (Optional Warning) ---
	if (!validateProviderModelCombination(providerName, modelId)) {
		console.warn(
			chalk.yellow(
				`Warning: Model "${modelId}" is not in the known list for provider "${providerName}". Ensure it is valid.`
			)
		);
	}

	// --- 4. Specific Research Warning (Optional) ---
	if (
		providerName === 'anthropic' ||
		(providerName === 'openai' && modelId.includes('3.5'))
	) {
		console.warn(
			chalk.yellow(
				`Warning: Provider "${providerName}" with model "${modelId}" may not be ideal for research tasks. Perplexity or Grok recommended.`
			)
		);
	}

	// --- Proceed with setting ---
	const config = readConfig(explicitRoot);
	config.models.research = { provider: providerName, modelId: modelId };
	// Pass explicitRoot down
	if (writeConfig(config, explicitRoot)) {
		console.log(
			chalk.green(`Research AI model set to: ${providerName} / ${modelId}`)
		);
		return true;
	} else {
		return false;
	}
}

/**
 * Sets the fallback AI model (provider and modelId) in the configuration file.
 * @param {string} providerName The name of the provider to set.
 * @param {string} modelId The ID of the model to set.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {boolean} True if successful, false otherwise.
 */
function setFallbackModel(providerName, modelId, explicitRoot = null) {
	// --- 1. Validate Provider First ---
	if (!validateProvider(providerName)) {
		console.error(
			chalk.red(`Error: "${providerName}" is not a valid provider.`)
		);
		console.log(
			chalk.yellow(`Available providers: ${VALID_PROVIDERS.join(', ')}`)
		);
		return false;
	}

	// --- 2. Validate Role Second ---
	const allModels = getAvailableModels(); // Get all models to check roles
	const modelData = allModels.find(
		(m) => m.id === modelId && m.provider === providerName
	);

	if (
		!modelData ||
		!modelData.allowed_roles ||
		!modelData.allowed_roles.includes('fallback')
	) {
		console.error(
			chalk.red(
				`Error: Model "${modelId}" is not allowed for the 'fallback' role.`
			)
		);
		// Try to suggest valid models for the role
		const allowedFallbackModels = allModels
			.filter((m) => m.allowed_roles?.includes('fallback'))
			.map((m) => `  - ${m.provider} / ${m.id}`)
			.join('\n');
		if (allowedFallbackModels) {
			console.log(
				chalk.yellow(
					'\nAllowed models for fallback role:\n' + allowedFallbackModels
				)
			);
		}
		return false;
	}

	// --- 3. Validate Model Combination (Optional Warning) ---
	if (!validateProviderModelCombination(providerName, modelId)) {
		console.warn(
			chalk.yellow(
				`Warning: Model "${modelId}" is not in the known list for provider "${providerName}". Ensure it is valid.`
			)
		);
	}

	// --- Proceed with setting ---
	const config = readConfig(explicitRoot);
	if (!config.models) {
		config.models = {}; // Ensure models object exists
	}
	// Ensure fallback object exists
	if (!config.models.fallback) {
		config.models.fallback = {};
	}

	config.models.fallback = { provider: providerName, modelId: modelId };

	return writeConfig(config, explicitRoot);
}

/**
 * Gets a list of available models based on the MODEL_MAP.
 * @returns {Array<{id: string, name: string, provider: string, swe_score: number|null, cost_per_1m_tokens: {input: number|null, output: number|null}|null, allowed_roles: string[]}>}
 */
function getAvailableModels() {
	const available = [];
	for (const [provider, models] of Object.entries(MODEL_MAP)) {
		if (models.length > 0) {
			models.forEach((modelObj) => {
				// Basic name generation - can be improved
				const modelId = modelObj.id;
				const sweScore = modelObj.swe_score;
				const cost = modelObj.cost_per_1m_tokens;
				const allowedRoles = modelObj.allowed_roles || ['main', 'fallback'];
				const nameParts = modelId
					.split('-')
					.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
				// Handle specific known names better if needed
				let name = nameParts.join(' ');
				if (modelId === 'claude-3.5-sonnet-20240620')
					name = 'Claude 3.5 Sonnet';
				if (modelId === 'claude-3-7-sonnet-20250219')
					name = 'Claude 3.7 Sonnet';
				if (modelId === 'gpt-4o') name = 'GPT-4o';
				if (modelId === 'gpt-4-turbo') name = 'GPT-4 Turbo';
				if (modelId === 'sonar-pro') name = 'Perplexity Sonar Pro';
				if (modelId === 'sonar-mini') name = 'Perplexity Sonar Mini';

				available.push({
					id: modelId,
					name: name,
					provider: provider,
					swe_score: sweScore,
					cost_per_1m_tokens: cost,
					allowed_roles: allowedRoles
				});
			});
		} else {
			// For providers with empty lists (like ollama), maybe add a placeholder or skip
			available.push({
				id: `[${provider}-any]`,
				name: `Any (${provider})`,
				provider: provider
			});
		}
	}
	return available;
}

/**
 * Writes the configuration object to the file.
 * @param {Object} config The configuration object to write.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {boolean} True if successful, false otherwise.
 */
function writeConfig(config, explicitRoot = null) {
	const rootPath = explicitRoot || findProjectRoot();
	if (!rootPath) {
		console.error(
			chalk.red(
				'Error: Could not determine project root. Configuration not saved.'
			)
		);
		return false;
	}
	// Ensure we don't double-join if explicitRoot already contains the filename
	const configPath =
		path.basename(rootPath) === CONFIG_FILE_NAME
			? rootPath
			: path.join(rootPath, CONFIG_FILE_NAME);

	try {
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		return true;
	} catch (error) {
		console.error(
			chalk.red(
				`Error writing configuration to ${configPath}: ${error.message}`
			)
		);
		return false;
	}
}

/**
 * Checks if the required API key environment variable is set for a given provider.
 * @param {string} providerName The name of the provider.
 * @returns {boolean} True if the API key environment variable exists and is non-empty, false otherwise.
 */
function hasApiKeyForProvider(providerName) {
	switch (providerName) {
		case 'anthropic':
			return !!process.env.ANTHROPIC_API_KEY;
		case 'openai':
		case 'openrouter': // OpenRouter uses OpenAI-compatible key
			return !!process.env.OPENAI_API_KEY;
		case 'google':
			return !!process.env.GOOGLE_API_KEY;
		case 'perplexity':
			return !!process.env.PERPLEXITY_API_KEY;
		case 'grok':
		case 'xai': // Added alias for Grok
			return !!process.env.GROK_API_KEY;
		case 'ollama':
			return true; // Ollama runs locally, no cloud API key needed
		default:
			return false; // Unknown provider cannot have a key checked
	}
}

/**
 * Checks the API key status within .cursor/mcp.json for a given provider.
 * Reads the mcp.json file, finds the taskmaster-ai server config, and checks the relevant env var.
 * @param {string} providerName The name of the provider.
 * @returns {boolean} True if the key exists and is not a placeholder, false otherwise.
 */
function getMcpApiKeyStatus(providerName) {
	const rootDir = findProjectRoot(); // Use existing root finding
	if (!rootDir) {
		console.warn(
			chalk.yellow('Warning: Could not find project root to check mcp.json.')
		);
		return false; // Cannot check without root
	}
	const mcpConfigPath = path.join(rootDir, '.cursor', 'mcp.json');

	if (!fs.existsSync(mcpConfigPath)) {
		// console.warn(chalk.yellow('Warning: .cursor/mcp.json not found.'));
		return false; // File doesn't exist
	}

	try {
		const mcpConfigRaw = fs.readFileSync(mcpConfigPath, 'utf-8');
		const mcpConfig = JSON.parse(mcpConfigRaw);

		const mcpEnv = mcpConfig?.mcpServers?.['taskmaster-ai']?.env;
		if (!mcpEnv) {
			// console.warn(chalk.yellow('Warning: Could not find taskmaster-ai env in mcp.json.'));
			return false; // Structure missing
		}

		let apiKeyToCheck = null;
		let placeholderValue = null;

		switch (providerName) {
			case 'anthropic':
				apiKeyToCheck = mcpEnv.ANTHROPIC_API_KEY;
				placeholderValue = 'YOUR_ANTHROPIC_API_KEY_HERE';
				break;
			case 'openai':
			case 'openrouter':
				apiKeyToCheck = mcpEnv.OPENAI_API_KEY;
				placeholderValue = 'YOUR_OPENAI_API_KEY_HERE'; // Assuming placeholder matches OPENAI
				break;
			case 'google':
				apiKeyToCheck = mcpEnv.GOOGLE_API_KEY;
				placeholderValue = 'YOUR_GOOGLE_API_KEY_HERE';
				break;
			case 'perplexity':
				apiKeyToCheck = mcpEnv.PERPLEXITY_API_KEY;
				placeholderValue = 'YOUR_PERPLEXITY_API_KEY_HERE';
				break;
			case 'grok':
			case 'xai':
				apiKeyToCheck = mcpEnv.GROK_API_KEY;
				placeholderValue = 'YOUR_GROK_API_KEY_HERE';
				break;
			case 'ollama':
				return true; // No key needed
			default:
				return false; // Unknown provider
		}

		return !!apiKeyToCheck && apiKeyToCheck !== placeholderValue;
	} catch (error) {
		console.error(
			chalk.red(`Error reading or parsing .cursor/mcp.json: ${error.message}`)
		);
		return false;
	}
}

export {
	// Not exporting findProjectRoot as it's internal for CLI context now
	readConfig, // Keep exporting if direct access is needed elsewhere
	writeConfig, // Keep exporting if direct access is needed elsewhere
	validateProvider,
	validateProviderModelCombination,
	getMainProvider,
	getMainModelId,
	getResearchProvider,
	getResearchModelId,
	getFallbackProvider,
	getFallbackModelId,
	setMainModel,
	setResearchModel,
	setFallbackModel,
	VALID_PROVIDERS,
	MODEL_MAP,
	getAvailableModels,
	hasApiKeyForProvider,
	getMcpApiKeyStatus
};
