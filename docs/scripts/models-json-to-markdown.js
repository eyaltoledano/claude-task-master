import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supportedModelsPath = path.join(
	__dirname,
	'..',
	'modules',
	'supported-models.json'
);
const outputMarkdownPath = path.join(
	__dirname,
	'..',
	'..',
	'docs',
	'models.md'
);

function formatCost(cost) {
	if (cost === null || cost === undefined) {
		return '—';
	}
	return cost;
}

function formatSweScore(score) {
	if (score === null || score === undefined || score === 0) {
		return '—';
	}
	return score.toString();
}

function generateMarkdownTable(title, models) {
	if (!models || models.length === 0) {
		return `## ${title}\n\nNo models in this category.\n\n`;
	}
	let table = `## ${title}\n\n`;
	table += '| Provider | Model Name | SWE Score | Input Cost | Output Cost |\n';
	table += '|---|---|---|---|---|\n';
	models.forEach((model) => {
		table += `| ${model.provider} | ${model.modelName} | ${formatSweScore(model.sweScore)} | ${formatCost(model.inputCost)} | ${formatCost(model.outputCost)} |\n`;
	});
	table += '\n';
	return table;
}

function main() {
	try {
		const correctSupportedModelsPath = path.join(
			__dirname,
			'..',
			'..',
			'scripts',
			'modules',
			'supported-models.json'
		);
		const correctOutputMarkdownPath = path.join(__dirname, '..', 'models.md');

		const supportedModelsContent = fs.readFileSync(
			correctSupportedModelsPath,
			'utf8'
		);
		const supportedModels = JSON.parse(supportedModelsContent);

		const mainModels = [];
		const researchModels = [];
		const fallbackModels = [];

		for (const provider in supportedModels) {
			if (Object.hasOwnProperty.call(supportedModels, provider)) {
				const models = supportedModels[provider];
				models.forEach((model) => {
					const modelEntry = {
						provider: provider,
						modelName: model.id,
						sweScore: model.swe_score,
						inputCost: model.cost_per_1m_tokens
							? model.cost_per_1m_tokens.input
							: null,
						outputCost: model.cost_per_1m_tokens
							? model.cost_per_1m_tokens.output
							: null
					};

					if (model.allowed_roles.includes('main')) {
						mainModels.push(modelEntry);
					}
					if (model.allowed_roles.includes('research')) {
						researchModels.push(modelEntry);
					}
					if (model.allowed_roles.includes('fallback')) {
						fallbackModels.push(modelEntry);
					}
				});
			}
		}

		const date = new Date();
		const monthNames = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December'
		];
		const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

		let markdownContent = `# Available Models as of ${formattedDate}\n\n`;
		markdownContent += generateMarkdownTable('Main Models', mainModels);
		markdownContent += generateMarkdownTable('Research Models', researchModels);
		markdownContent += generateMarkdownTable('Fallback Models', fallbackModels);

		fs.writeFileSync(correctOutputMarkdownPath, markdownContent, 'utf8');
		console.log(`Successfully updated ${correctOutputMarkdownPath}`);
	} catch (error) {
		console.error('Error transforming models.json to models.md:', error);
		process.exit(1);
	}
}

main();
