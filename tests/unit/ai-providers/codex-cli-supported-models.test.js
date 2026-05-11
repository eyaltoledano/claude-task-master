import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supportedModelsPath = path.resolve(
	__dirname,
	'../../../scripts/modules/supported-models.json'
);
const supportedModels = JSON.parse(
	fs.readFileSync(supportedModelsPath, 'utf8')
);

describe('codex-cli supported models catalog', () => {
	it('includes GPT-5.5 for ChatGPT OAuth Codex CLI users', () => {
		const codexModels = supportedModels['codex-cli'].map((model) => model.id);

		expect(codexModels).toContain('gpt-5.5');
	});
});
