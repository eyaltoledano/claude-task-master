// Utility to update .gitignore according to user preference for storing task files in git
import fs from 'fs';
import path from 'path';

/**
 * Updates the .gitignore file at targetPath based on the provided content and storeTasksInGit flag.
 * @param {string} targetPath - Path to the .gitignore file
 * @param {string} content - Template content for .gitignore
 * @param {boolean} storeTasksInGit - Whether to store tasks in git or not
 * @param {function} log - Logging function (level, message)
 */
function updateGitignore(targetPath, content, storeTasksInGit, log) {
	if (path.basename(targetPath) !== '.gitignore') return;
	// Split template lines
	let templateLines = content.split('\n');
	// Adjust last two lines
	const taskJsonIdx = templateLines.findIndex(
		(l) => l.trim().replace(/^#/, '').trim() === 'tasks.json'
	);
	const tasksDirIdx = templateLines.findIndex(
		(l) => l.trim().replace(/^#/, '').trim() === 'tasks/'
	);
	if (taskJsonIdx !== -1)
		templateLines[taskJsonIdx] = storeTasksInGit
			? '# tasks.json'
			: 'tasks.json';
	if (tasksDirIdx !== -1)
		templateLines[tasksDirIdx] = storeTasksInGit ? '# tasks/' : 'tasks/';

	// Read existing .gitignore
	let existingLines = [];
	if (fs.existsSync(targetPath)) {
		existingLines = fs.readFileSync(targetPath, 'utf8').split('\n');
	}
	// Remove any version (commented or not) of the two lines from existingLines
	existingLines = existingLines.filter((l) => {
		const trimmed = l.trim().replace(/^#/, '').trim();
		return trimmed !== 'tasks.json' && trimmed !== 'tasks/';
	});
	// Prepare the correct lines from templateLines
	const taskLines = templateLines
		.filter((l) => {
			const trimmed = l.trim().replace(/^#/, '').trim();
			return trimmed === 'tasks.json' || trimmed === 'tasks/';
		})
		.filter((l) => {
			const trimmed = l.trim().replace(/^#/, '').trim();
			return !existingLines.some(
				(e) => e.trim().replace(/^#/, '').trim() === trimmed
			);
		});
	// Only add the comment if at least one line is being added
	let finalLines = [...existingLines];
	if (taskLines.length > 0) {
		// Only add the comment if not already present
		const hasTaskFilesComment = finalLines.some(
			(l) => l.trim() === '# Task files'
		);
		if (!hasTaskFilesComment) {
			finalLines.push('# Task files');
		}
		finalLines = [...finalLines, ...taskLines];
	}
	fs.writeFileSync(targetPath, finalLines.join('\n'));
	if (typeof log === 'function') {
		log('info', `Updated ${targetPath} according to user preference`);
	}
}

export default updateGitignore;
