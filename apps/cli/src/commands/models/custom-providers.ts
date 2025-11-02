/**
 * @fileoverview Custom provider handlers for model setup
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { CUSTOM_PROVIDERS } from '@tm/core';
import type {
	CustomProviderConfig,
	CustomProviderId,
	CUSTOM_PROVIDER_IDS,
	ModelRole
} from './types.js';
import { validateOpenRouterModel, validateOllamaModel } from './fetchers.js';

/**
 * Configuration for all custom providers
 */
export const customProviderConfigs: Record<
	keyof typeof CUSTOM_PROVIDER_IDS,
	CustomProviderConfig
> = {
	OPENROUTER: {
		id: '__CUSTOM_OPENROUTER__',
		name: '* Custom OpenRouter model',
		provider: CUSTOM_PROVIDERS.OPENROUTER,
		promptMessage: (role) =>
			`Enter the custom OpenRouter Model ID for the ${role} role:`,
		validate: async (modelId) => {
			const isValid = await validateOpenRouterModel(modelId);
			if (!isValid) {
				console.error(
					chalk.red(
						`Error: Model ID "${modelId}" not found in the live OpenRouter model list. Please check the ID.`
					)
				);
			}
			return isValid;
		}
	},
	OLLAMA: {
		id: '__CUSTOM_OLLAMA__',
		name: '* Custom Ollama model',
		provider: CUSTOM_PROVIDERS.OLLAMA,
		requiresBaseURL: true,
		defaultBaseURL: 'http://localhost:11434/api',
		promptMessage: (role) =>
			`Enter the custom Ollama Model ID for the ${role} role:`,
		validate: async (modelId, baseURL) => {
			const urlToCheck = baseURL || 'http://localhost:11434/api';
			const isValid = await validateOllamaModel(modelId, urlToCheck);
			if (!isValid) {
				console.error(
					chalk.red(
						`Error: Model ID "${modelId}" not found in the Ollama instance. Please verify the model is pulled and available.`
					)
				);
				console.log(
					chalk.yellow(
						`You can check available models with: curl ${urlToCheck}/tags`
					)
				);
			}
			return isValid;
		}
	},
	BEDROCK: {
		id: '__CUSTOM_BEDROCK__',
		name: '* Custom Bedrock model',
		provider: CUSTOM_PROVIDERS.BEDROCK,
		promptMessage: (role) =>
			`Enter the custom Bedrock Model ID for the ${role} role (e.g., anthropic.claude-3-sonnet-20240229-v1:0):`,
		checkEnvVars: () => {
			if (
				!process.env.AWS_ACCESS_KEY_ID ||
				!process.env.AWS_SECRET_ACCESS_KEY
			) {
				console.warn(
					chalk.yellow(
						'Warning: AWS_ACCESS_KEY_ID and/or AWS_SECRET_ACCESS_KEY environment variables are missing. Will fallback to system configuration (ex: aws config files or ec2 instance profiles).'
					)
				);
			}
			return true;
		}
	},
	AZURE: {
		id: '__CUSTOM_AZURE__',
		name: '* Custom Azure model',
		provider: CUSTOM_PROVIDERS.AZURE,
		promptMessage: (role) =>
			`Enter the custom Azure OpenAI Model ID for the ${role} role (e.g., gpt-4o):`,
		checkEnvVars: () => {
			if (
				!process.env.AZURE_OPENAI_API_KEY ||
				!process.env.AZURE_OPENAI_ENDPOINT
			) {
				console.error(
					chalk.red(
						'Error: AZURE_OPENAI_API_KEY and/or AZURE_OPENAI_ENDPOINT environment variables are missing. Please set them before using custom Azure models.'
					)
				);
				return false;
			}
			return true;
		}
	},
	VERTEX: {
		id: '__CUSTOM_VERTEX__',
		name: '* Custom Vertex model',
		provider: CUSTOM_PROVIDERS.VERTEX,
		promptMessage: (role) =>
			`Enter the custom Vertex AI Model ID for the ${role} role (e.g., gemini-1.5-pro-002):`,
		checkEnvVars: () => {
			if (
				!process.env.GOOGLE_API_KEY &&
				!process.env.GOOGLE_APPLICATION_CREDENTIALS
			) {
				console.error(
					chalk.red(
						'Error: Either GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS environment variable is required. Please set one before using custom Vertex models.'
					)
				);
				return false;
			}
			return true;
		}
	},
	LMSTUDIO: {
		id: '__CUSTOM_LMSTUDIO__',
		name: '* Custom LMStudio model',
		provider: CUSTOM_PROVIDERS.LMSTUDIO,
		requiresBaseURL: true,
		defaultBaseURL: 'http://localhost:1234/v1',
		promptMessage: (role) =>
			`Enter the custom LM Studio Model ID for the ${role} role:`,
		checkEnvVars: () => {
			console.log(
				chalk.blue(
					'Note: LM Studio runs locally. Make sure the LM Studio server is running.'
				)
			);
			return true;
		}
	},
	OPENAI_COMPATIBLE: {
		id: '__CUSTOM_OPENAI_COMPATIBLE__',
		name: '* Custom OpenAI-compatible model',
		provider: CUSTOM_PROVIDERS.OPENAI_COMPATIBLE,
		promptMessage: (role) =>
			`Enter the custom OpenAI-compatible Model ID for the ${role} role:`,
		requiresBaseURL: true,
		checkEnvVars: () => {
			console.log(
				chalk.blue(
					'Note: This will configure a generic OpenAI-compatible provider. Make sure your API endpoint is accessible.'
				)
			);
			return true;
		}
	}
};

/**
 * Handle custom provider selection
 */
export async function handleCustomProvider(
	providerId: CustomProviderId,
	role: ModelRole,
	currentModel: {
		modelId?: string | null;
		provider?: string | null;
		baseURL?: string | null;
	} | null = null
): Promise<{
	modelId: string | null;
	provider: string | null;
	baseURL?: string | null;
	success: boolean;
}> {
	// Find the matching config
	const configEntry = Object.entries(customProviderConfigs).find(
		([_, config]) => config.id === providerId
	);

	if (!configEntry) {
		console.error(chalk.red(`Unknown custom provider: ${providerId}`));
		return { modelId: null, provider: null, success: false };
	}

	const config = configEntry[1];

	// Check environment variables if needed
	if (config.checkEnvVars && !config.checkEnvVars()) {
		return { modelId: null, provider: null, success: false };
	}

	// Prompt for baseURL if required
	let baseURL: string | null = null;
	if (config.requiresBaseURL) {
		// Determine the appropriate default baseURL
		let defaultBaseURL: string;
		if (currentModel?.provider === config.provider && currentModel?.baseURL) {
			// Already using this provider - preserve existing baseURL
			defaultBaseURL = currentModel.baseURL;
		} else {
			// Switching providers or no existing baseURL - use fallback default
			defaultBaseURL = config.defaultBaseURL || '';
		}

		const baseURLAnswer = await inquirer.prompt([
			{
				type: 'input',
				name: 'baseURL',
				message: `Enter the base URL for the ${role} role:`,
				default: defaultBaseURL,
				validate: (input: string) => {
					if (!input || input.trim() === '') {
						return `Base URL is required for ${config.provider} providers`;
					}
					try {
						new URL(input);
						return true;
					} catch {
						return 'Please enter a valid URL';
					}
				}
			}
		]);
		baseURL = baseURLAnswer.baseURL;
	}

	// Prompt for custom ID
	const { customId } = await inquirer.prompt([
		{
			type: 'input',
			name: 'customId',
			message: config.promptMessage(role)
		}
	]);

	if (!customId) {
		console.log(chalk.yellow('No custom ID entered. Skipping role.'));
		return { modelId: null, provider: null, success: true };
	}

	// Validate if validation function exists
	if (config.validate) {
		const isValid = await config.validate(customId, baseURL || undefined);
		if (!isValid) {
			return { modelId: null, provider: null, success: false };
		}
	} else {
		console.log(
			chalk.blue(
				`Custom ${config.provider} model "${customId}" will be used. No validation performed.`
			)
		);
	}

	return {
		modelId: customId,
		provider: config.provider,
		baseURL: baseURL,
		success: true
	};
}

/**
 * Get all custom provider options for display
 */
export function getCustomProviderOptions(): Array<{
	name: string;
	value: CustomProviderId;
	short: string;
}> {
	return Object.values(customProviderConfigs).map((config) => ({
		name: config.name,
		value: config.id,
		short: config.name
	}));
}
