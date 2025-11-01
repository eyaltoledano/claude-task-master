/**
 * @fileoverview Interactive prompt logic for model selection
 */

import chalk from 'chalk';
import search, { Separator } from '@inquirer/search';
import { getAvailableModels } from '../../lib/model-management.js';
import type {
	ModelRole,
	ModelInfo,
	CurrentModels,
	PromptData,
	ModelChoice
} from './types.js';
import { getCustomProviderOptions } from './custom-providers.js';

/**
 * Build prompt choices for a specific role
 */
export function buildPromptChoices(
	role: ModelRole,
	currentModels: CurrentModels,
	allowNone = false
): PromptData {
	const currentModel = currentModels[role];
	const allModels = getAvailableModels();

	// Group models by provider (filter out models without provider)
	const modelsByProvider = allModels
		.filter(
			(model): model is ModelInfo & { provider: string } => !!model.provider
		)
		.reduce(
			(acc, model) => {
				if (!acc[model.provider]) {
					acc[model.provider] = [];
				}
				acc[model.provider].push(model);
				return acc;
			},
			{} as Record<string, ModelInfo[]>
		);

	// System options (cancel and no change)
	const systemOptions: ModelChoice[] = [];
	const cancelOption: ModelChoice = {
		name: '⏹ Cancel Model Setup',
		value: '__CANCEL__',
		short: 'Cancel'
	};
	const noChangeOption: ModelChoice | null =
		currentModel?.modelId && currentModel?.provider
			? {
					name: `✔ No change to current ${role} model (${currentModel.provider}/${currentModel.modelId})`,
					value: '__NO_CHANGE__',
					short: 'No change'
				}
			: null;

	if (noChangeOption) {
		systemOptions.push(noChangeOption);
	}
	systemOptions.push(cancelOption);

	// Build role-specific model choices
	const roleChoices: ModelChoice[] = Object.entries(modelsByProvider)
		.flatMap(([provider, models]) => {
			return models
				.filter((m) => m.allowed_roles && m.allowed_roles.includes(role))
				.map((m) => {
					// Use model name if available, otherwise fall back to model ID
					const displayName = m.name || m.id;
					return {
						name: `${provider} / ${displayName} ${
							m.cost_per_1m_tokens
								? chalk.gray(
										`($${m.cost_per_1m_tokens.input.toFixed(2)} input | $${m.cost_per_1m_tokens.output.toFixed(2)} output)`
									)
								: ''
						}`,
						value: { id: m.id, provider },
						short: `${provider}/${displayName}`
					};
				});
		})
		.filter((choice) => choice !== null);

	// Find current model index
	let currentChoiceIndex = -1;
	if (currentModel?.modelId && currentModel?.provider) {
		currentChoiceIndex = roleChoices.findIndex(
			(choice) =>
				typeof choice.value === 'object' &&
				choice.value !== null &&
				'id' in choice.value &&
				choice.value.id === currentModel.modelId &&
				choice.value.provider === currentModel.provider
		);
	}

	// Get custom provider options
	const customProviderOptions = getCustomProviderOptions();

	// Build final choices array
	const systemLength = systemOptions.length;
	let choices: (ModelChoice | Separator)[];
	let defaultIndex: number;

	if (allowNone) {
		choices = [
			...systemOptions,
			new Separator('\n── Standard Models ──'),
			{ name: '⚪ None (disable)', value: null, short: 'None' },
			...roleChoices,
			new Separator('\n── Custom Providers ──'),
			...customProviderOptions
		];
		const noneOptionIndex = systemLength + 1;
		defaultIndex =
			currentChoiceIndex !== -1
				? currentChoiceIndex + systemLength + 2
				: noneOptionIndex;
	} else {
		choices = [
			...systemOptions,
			new Separator('\n── Standard Models ──'),
			...roleChoices,
			new Separator('\n── Custom Providers ──'),
			...customProviderOptions
		];
		defaultIndex =
			currentChoiceIndex !== -1
				? currentChoiceIndex + systemLength + 1
				: noChangeOption
					? 1
					: 0;
	}

	// Ensure defaultIndex is valid
	if (defaultIndex < 0 || defaultIndex >= choices.length) {
		defaultIndex = 0;
		console.warn(
			`Warning: Could not determine default model for role '${role}'. Defaulting to 'Cancel'.`
		);
	}

	return { choices, default: defaultIndex };
}

/**
 * Create search source for inquirer search prompt
 */
export function createSearchSource(
	choices: (ModelChoice | Separator)[],
	_defaultValue: number
) {
	return (searchTerm = '') => {
		const filteredChoices = choices.filter((choice) => {
			// Separators are always included
			if (choice instanceof Separator) return true;
			// Filter regular choices by search term
			const searchText = (choice as ModelChoice).name || '';
			return searchText.toLowerCase().includes(searchTerm.toLowerCase());
		});
		// Map ModelChoice to the format inquirer expects
		return Promise.resolve(
			filteredChoices.map((choice) => {
				if (choice instanceof Separator) return choice;
				const mc = choice as ModelChoice;
				return {
					name: mc.name,
					value: mc.value,
					short: mc.short
				};
			})
		);
	};
}

/**
 * Display introductory message for interactive setup
 */
export function displaySetupIntro(): void {
	console.log(chalk.cyan('\n🎯 Interactive Model Setup'));
	console.log(chalk.gray('━'.repeat(50)));
	console.log(chalk.yellow('💡 Navigation tips:'));
	console.log(chalk.gray('   • Type to search and filter options'));
	console.log(chalk.gray('   • Use ↑↓ arrow keys to navigate results'));
	console.log(
		chalk.gray(
			'   • Standard models are listed first, custom providers at bottom'
		)
	);
	console.log(chalk.gray('   • Press Enter to select\n'));
}

/**
 * Prompt user to select a model for a specific role
 */
export async function promptForModel(
	role: ModelRole,
	promptData: PromptData
): Promise<string | { id: string; provider: string } | null> {
	const roleLabels = {
		main: 'main model for generation/updates',
		research: 'research model',
		fallback: 'fallback model (optional)'
	};

	const answer = await search({
		message: `Select the ${roleLabels[role]}:`,
		source: createSearchSource(promptData.choices, promptData.default),
		pageSize: 15
	});

	return answer;
}
