/**
 * @fileoverview Main setup orchestration for interactive model configuration
 */

import chalk from 'chalk';
import {
	getModelConfiguration,
	setModel,
	getConfig,
	writeConfig
} from '../../lib/model-management.js';
import type { ModelRole, CurrentModels, CustomProviderId } from './types.js';
import {
	buildPromptChoices,
	displaySetupIntro,
	promptForModel
} from './prompts.js';
import {
	handleCustomProvider,
	customProviderConfigs
} from './custom-providers.js';

/**
 * Check if a value is a custom provider ID
 */
function isCustomProviderId(value: unknown): value is CustomProviderId {
	if (typeof value !== 'string') return false;
	return Object.values(customProviderConfigs).some(
		(config) => config.id === value
	);
}

/**
 * Handle setting a model for a specific role
 */
async function handleSetModel(
	role: ModelRole,
	selectedValue: string | { id: string; provider: string } | null,
	currentModel: {
		modelId?: string | null;
		provider?: string | null;
		baseURL?: string | null;
	} | null,
	projectRoot: string
): Promise<{ success: boolean; modified: boolean }> {
	const currentModelId = currentModel?.modelId ?? null;
	const currentProvider = currentModel?.provider ?? null;
	const currentBaseURL = currentModel?.baseURL ?? null;
	// Handle cancellation
	if (selectedValue === '__CANCEL__') {
		console.log(
			chalk.yellow(`\nSetup canceled during ${role} model selection.`)
		);
		return { success: false, modified: false };
	}

	// Handle no change
	if (selectedValue === '__NO_CHANGE__') {
		console.log(chalk.gray(`No change selected for ${role} model.`));
		return { success: true, modified: false };
	}

	let modelIdToSet: string | null = null;
	let providerHint: string | null = null;
	let baseURL: string | null = null;

	// Handle custom providers
	if (isCustomProviderId(selectedValue)) {
		const result = await handleCustomProvider(
			selectedValue,
			role,
			currentModel
		);
		if (!result.success) {
			return { success: false, modified: false };
		}
		if (!result.modelId) {
			return { success: true, modified: false };
		}
		modelIdToSet = result.modelId;
		providerHint = result.provider;
		baseURL = result.baseURL || null;
	}
	// Handle standard model selection
	else if (
		selectedValue &&
		typeof selectedValue === 'object' &&
		'id' in selectedValue
	) {
		modelIdToSet = selectedValue.id;
		providerHint = selectedValue.provider;
	}
	// Handle disabling fallback
	else if (selectedValue === null && role === 'fallback') {
		modelIdToSet = null;
		providerHint = null;
	}
	// Unknown selection
	else if (selectedValue) {
		console.error(
			chalk.red(
				`Internal Error: Unexpected selection value for ${role}: ${JSON.stringify(selectedValue)}`
			)
		);
		return { success: false, modified: false };
	}

	// Check if there's actually a change to make
	if (
		modelIdToSet === currentModelId &&
		(providerHint ?? null) === currentProvider &&
		(baseURL ?? null) === currentBaseURL
	) {
		return { success: true, modified: false };
	}

	// Set the model
	if (modelIdToSet) {
		const result = await setModel(role, modelIdToSet, {
			projectRoot,
			providerHint: providerHint || undefined,
			baseURL: baseURL || undefined
		});

		if (result.success) {
			console.log(
				chalk.blue(
					`Set ${role} model: ${result.data?.provider} / ${result.data?.modelId}`
				)
			);
			if (result.data?.warning) {
				console.log(chalk.yellow(result.data?.warning));
			}
			return { success: true, modified: true };
		} else {
			console.error(
				chalk.red(
					`Error setting ${role} model: ${result.error?.message || 'Unknown'}`
				)
			);
			return { success: false, modified: false };
		}
	}
	// Disable fallback model
	else if (role === 'fallback') {
		const currentCfg = getConfig(projectRoot);
		if (currentCfg?.models?.fallback?.modelId) {
			currentCfg.models.fallback = {
				...currentCfg.models.fallback,
				provider: undefined,
				modelId: undefined
			};
			if (writeConfig(currentCfg, projectRoot)) {
				console.log(chalk.blue('Fallback model disabled.'));
				return { success: true, modified: true };
			} else {
				console.error(
					chalk.red('Failed to disable fallback model in config file.')
				);
				return { success: false, modified: false };
			}
		} else {
			console.log(chalk.blue('Fallback model was already disabled.'));
			return { success: true, modified: false };
		}
	}

	return { success: true, modified: false };
}

/**
 * Run interactive model setup
 */
export async function runInteractiveSetup(
	projectRoot: string
): Promise<boolean> {
	if (!projectRoot) {
		console.error(
			chalk.red(
				'Error: Could not determine project root for interactive setup.'
			)
		);
		process.exit(1);
	}

	// Get current configuration
	const currentConfigResult = await getModelConfiguration({ projectRoot });
	const currentModels: CurrentModels =
		currentConfigResult.success && currentConfigResult.data
			? {
					main: currentConfigResult.data.activeModels.main
						? {
								modelId: currentConfigResult.data.activeModels.main.modelId,
								provider: currentConfigResult.data.activeModels.main.provider,
								baseURL: currentConfigResult.data.activeModels.main.baseURL
							}
						: null,
					research: currentConfigResult.data.activeModels.research
						? {
								modelId: currentConfigResult.data.activeModels.research.modelId,
								provider:
									currentConfigResult.data.activeModels.research.provider,
								baseURL: currentConfigResult.data.activeModels.research.baseURL
							}
						: null,
					fallback: currentConfigResult.data.activeModels.fallback
						? {
								modelId: currentConfigResult.data.activeModels.fallback.modelId,
								provider:
									currentConfigResult.data.activeModels.fallback.provider,
								baseURL: currentConfigResult.data.activeModels.fallback.baseURL
							}
						: null
				}
			: { main: null, research: null, fallback: null };

	// Handle config load failure gracefully
	if (
		!currentConfigResult.success &&
		currentConfigResult.error?.code !== 'CONFIG_MISSING'
	) {
		console.warn(
			chalk.yellow(
				`Warning: Could not load current model configuration: ${currentConfigResult.error?.message || 'Unknown error'}. Proceeding with defaults.`
			)
		);
	}

	// Build prompt data
	const mainPromptData = buildPromptChoices('main', currentModels);
	const researchPromptData = buildPromptChoices('research', currentModels);
	const fallbackPromptData = buildPromptChoices(
		'fallback',
		currentModels,
		true
	);

	// Display intro
	displaySetupIntro();

	// Prompt for main model
	const mainModel = await promptForModel('main', mainPromptData);
	if (mainModel === '__CANCEL__') {
		return false;
	}

	// Prompt for research model
	const researchModel = await promptForModel('research', researchPromptData);
	if (researchModel === '__CANCEL__') {
		return false;
	}

	// Prompt for fallback model
	const fallbackModel = await promptForModel('fallback', fallbackPromptData);
	if (fallbackModel === '__CANCEL__') {
		return false;
	}

	// Process all model selections
	let setupSuccess = true;
	let setupConfigModified = false;

	const mainResult = await handleSetModel(
		'main',
		mainModel,
		currentModels.main,
		projectRoot
	);
	if (!mainResult.success) setupSuccess = false;
	if (mainResult.modified) setupConfigModified = true;

	const researchResult = await handleSetModel(
		'research',
		researchModel,
		currentModels.research,
		projectRoot
	);
	if (!researchResult.success) setupSuccess = false;
	if (researchResult.modified) setupConfigModified = true;

	const fallbackResult = await handleSetModel(
		'fallback',
		fallbackModel,
		currentModels.fallback,
		projectRoot
	);
	if (!fallbackResult.success) setupSuccess = false;
	if (fallbackResult.modified) setupConfigModified = true;

	// Display final result
	if (setupSuccess && setupConfigModified) {
		console.log(chalk.green.bold('\nModel setup complete!'));
	} else if (setupSuccess && !setupConfigModified) {
		console.log(chalk.yellow('\nNo changes made to model configuration.'));
	} else {
		console.error(
			chalk.red(
				'\nErrors occurred during model selection. Please review and try again.'
			)
		);
	}

	return setupSuccess;
}
