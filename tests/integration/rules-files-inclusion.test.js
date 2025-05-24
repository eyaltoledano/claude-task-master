import fs from 'fs';
import path from 'path';

describe('Rules Files Inclusion in Package', () => {
	test('package.json includes assets/** in the "files" array for rules files', () => {
		const packageJsonPath = path.join(process.cwd(), 'package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		expect(packageJson.files).toContain('assets/**');
	});

	test('all rules files exist in assets/rules directory', () => {
		const rulesDir = path.join(process.cwd(), 'assets', 'rules');
		const expectedFiles = [
			'ai_providers.mdc',
			'ai_services.mdc',
			'architecture.mdc',
			'changeset.mdc',
			'commands.mdc',
			'cursor_rules.mdc',
			'dependencies.mdc',
			'dev_workflow.mdc',
			'glossary.mdc',
			'mcp.mdc',
			'new_features.mdc',
			'self_improve.mdc',
			'taskmaster.mdc',
			'tasks.mdc',
			'tests.mdc',
			'ui.mdc',
			'utilities.mdc'
		];
		for (const file of expectedFiles) {
			expect(fs.existsSync(path.join(rulesDir, file))).toBe(true);
		}
	});

	test('assets/rules directory is not empty', () => {
		const rulesDir = path.join(process.cwd(), 'assets', 'rules');
		const files = fs.readdirSync(rulesDir).filter((f) => !f.startsWith('.'));
		expect(files.length).toBeGreaterThan(0);
	});
});
