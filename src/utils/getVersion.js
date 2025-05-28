import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from '../../scripts/modules/utils.js';

/**
 * Reads the version from the nearest package.json relative to this file.
 * Returns 'unknown' if not found or on error.
 * @returns {string} The version string or 'unknown'.
 */
export function getTaskMasterVersion() {
	let version = 'unknown';
	try {
		// Get the directory of the current module (getPackageVersion.js)
		const currentModuleFilename = fileURLToPath(import.meta.url);
		const currentModuleDirname = path.dirname(currentModuleFilename);
		// Construct the path to package.json relative to this file (../../package.json)
		const packageJsonPath = path.join(
			currentModuleDirname,
			'..',
			'..',
			'package.json'
		);

		if (fs.existsSync(packageJsonPath)) {
			const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
			const packageJson = JSON.parse(packageJsonContent);
			version = packageJson.version;
		}
	} catch (error) {
		// Silently fall back to default version
		log('warn', 'Could not read own package.json for version info.', error);
	}
	return version;
}
