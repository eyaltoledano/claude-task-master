import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SOURCE_DIRS = ['apps/cli/src', 'scripts/modules', 'src'];
const CODE_EXTENSIONS = new Set(['.js', '.ts']);
const BARE_WARNING_EMOJI = /⚠(?!️)/u;

function collectSourceFiles(dir) {
	const fullDir = path.join(ROOT, dir);
	const entries = fs.readdirSync(fullDir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			files.push(...collectSourceFiles(path.join(dir, entry.name)));
			continue;
		}

		if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
			files.push(path.join(dir, entry.name));
		}
	}

	return files;
}

describe('warning emoji presentation', () => {
	test('user-facing source files use emoji presentation for warning sign', () => {
		const offenders = SOURCE_DIRS.flatMap((dir) =>
			collectSourceFiles(dir).flatMap((file) => {
				const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
				return BARE_WARNING_EMOJI.test(content) ? [file] : [];
			})
		);

		expect(offenders).toEqual([]);
	});
});
