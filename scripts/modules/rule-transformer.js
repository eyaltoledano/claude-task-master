/**
 * Rule Transformer Module
 * Handles conversion of Cursor rules to brand rules
 *
 * This module procedurally generates .{brand}/rules files from assets/rules files,
 * eliminating the need to maintain both sets of files manually.
 */
import fs from 'fs';
import path from 'path';
import { log } from './utils.js';

// Import Roo Code conversionConfig and fileMap from profiles
import { conversionConfig, fileMap } from '../profiles/roo.js';

/**
 * Replace basic Cursor terms with brand equivalents
 */
function replaceBasicTerms(content) {
	let result = content;

	// Apply brand term replacements
	conversionConfig.brandTerms.forEach((pattern) => {
		if (typeof pattern.to === 'function') {
			result = result.replace(pattern.from, pattern.to);
		} else {
			result = result.replace(pattern.from, pattern.to);
		}
	});

	// Apply file extension replacements
	conversionConfig.fileExtensions.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	return result;
}

/**
 * Replace Cursor tool references with brand tool equivalents
 */
function replaceToolReferences(content) {
	let result = content;

	// Basic pattern for direct tool name replacements
	const toolNames = conversionConfig.toolNames;
	const toolReferencePattern = new RegExp(
		`\\b(${Object.keys(toolNames).join('|')})\\b`,
		'g'
	);

	// Apply direct tool name replacements
	result = result.replace(toolReferencePattern, (match, toolName) => {
		return toolNames[toolName] || toolName;
	});

	// Apply contextual tool replacements
	conversionConfig.toolContexts.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	// Apply tool group replacements
	conversionConfig.toolGroups.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	return result;
}

/**
 * Update documentation URLs to point to brand documentation
 */
function updateDocReferences(content) {
	let result = content;

	// Apply documentation URL replacements
	conversionConfig.docUrls.forEach((pattern) => {
		if (typeof pattern.to === 'function') {
			result = result.replace(pattern.from, pattern.to);
		} else {
			result = result.replace(pattern.from, pattern.to);
		}
	});

	return result;
}

/**
 * Update file references in markdown links
 */
function updateFileReferences(content) {
	const { pathPattern, replacement } = conversionConfig.fileReferences;
	return content.replace(pathPattern, replacement);
}

/**
 * Main transformation function that applies all conversions
 */
// Main transformation function that applies all conversions, now brand-generic
function transformCursorToBrandRules(content, conversionConfig, globalReplacements = []) {
	// Apply all transformations in appropriate order
	let result = content;
	result = replaceBasicTerms(result, conversionConfig);
	result = replaceToolReferences(result, conversionConfig);
	result = updateDocReferences(result, conversionConfig);
	result = updateFileReferences(result, conversionConfig);

	// Apply any global/catch-all replacements from the brand profile
	// Super aggressive failsafe pass to catch any variations we might have missed
	// This ensures critical transformations are applied even in contexts we didn't anticipate
	globalReplacements.forEach((pattern) => {
		if (typeof pattern.to === 'function') {
			result = result.replace(pattern.from, pattern.to);
		} else {
			result = result.replace(pattern.from, pattern.to);
		}
	});

	return result;
}

/**
 * Convert a single Cursor rule file to brand rule format
 */
function convertCursorRuleToBrandRule(sourcePath, targetPath, profile) {
	const { conversionConfig, brandName, globalReplacements } = profile;
	try {
		log(
			'info',
			`Converting Cursor rule ${path.basename(sourcePath)} to ${brandName} rule ${path.basename(targetPath)}`
		);

		// Read source content
		const content = fs.readFileSync(sourcePath, 'utf8');

		// Transform content
		const transformedContent = transformCursorToBrandRules(content, conversionConfig, globalReplacements);

		// Ensure target directory exists
		const targetDir = path.dirname(targetPath);
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		// Write transformed content
		fs.writeFileSync(targetPath, transformedContent);
		log(
			'success',
			`Successfully converted ${path.basename(sourcePath)} to ${path.basename(targetPath)}`
		);

		return true;
	} catch (error) {
		log(
			'error',
			`Failed to convert rule file ${path.basename(sourcePath)}: ${error.message}`
		);
		return false;
	}
}

/**
 * Process all Cursor rules and convert to brand rules
 */
function convertAllCursorRulesToBrandRules(projectDir, profile) {
	const { fileMap, brandName, rulesDir } = profile;
	// Use assets/rules as the source of rules instead of .cursor/rules
const cursorRulesDir = path.join(projectDir, 'assets', 'rules');
	const brandRulesDir = path.join(projectDir, rulesDir);

	if (!fs.existsSync(cursorRulesDir)) {
		log('warn', `Cursor rules directory not found: ${cursorRulesDir}`);
		return { success: 0, failed: 0 };
	}

	// Ensure brand rules directory exists
	if (!fs.existsSync(brandRulesDir)) {
		fs.mkdirSync(brandRulesDir, { recursive: true });
		log('info', `Created ${brandName} rules directory: ${brandRulesDir}`);
	}

	// Count successful and failed conversions
	let success = 0;
	let failed = 0;

	// Process each file in the Cursor rules directory
	fs.readdirSync(cursorRulesDir).forEach((file) => {
		if (file.endsWith('.mdc')) {
			const sourcePath = path.join(cursorRulesDir, file);

			// Determine target file name (either from mapping or by replacing extension)
			const targetFilename = fileMap[file] || file.replace('.mdc', '.md');
			const targetPath = path.join(brandRulesDir, targetFilename);

			// Convert the file
			if (convertCursorRuleToBrandRule(sourcePath, targetPath, profile)) {
				success++;
			} else {
				failed++;
			}
		}
	});

	log(
		'info',
		`Rule conversion complete: ${success} successful, ${failed} failed`
	);
	return { success, failed };
}

/**
 * Remove a brand's rules directory and, if empty, the parent brand folder (except .cursor)
 * @param {string} projectDir - The root directory of the project
 * @param {object} profile - The brand profile object
 * @returns {boolean} - True if removal succeeded, false otherwise
 */
function removeBrandRules(projectDir, profile) {
    const { brandName, rulesDir } = profile;
    // Do not allow removal of the default Cursor rules directory
    if (brandName.toLowerCase() === 'cursor') {
        log('warn', 'Cannot remove default Cursor rules directory. Skipping.');
        return false;
    }
    const brandRulesDir = path.join(projectDir, rulesDir);
    if (fs.existsSync(brandRulesDir)) {
        fs.rmSync(brandRulesDir, { recursive: true, force: true });
        log('info', `Removed rules directory: ${brandRulesDir}`);
        // Check if parent brand folder is empty
        const brandDir = path.dirname(brandRulesDir);
        if (
            fs.existsSync(brandDir) &&
            path.basename(brandDir) !== '.cursor' &&
            fs.readdirSync(brandDir).length === 0
        ) {
            fs.rmdirSync(brandDir);
            log('info', `Removed empty brand folder: ${brandDir}`);
        }
        return true;
    } else {
        log('warn', `Rules directory not found: ${brandRulesDir}`);
        return false;
    }
}

export { convertAllCursorRulesToBrandRules, convertCursorRuleToBrandRule, removeBrandRules };

