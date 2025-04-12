/**
 * Convert a string from camelCase to kebab-case
 * @param {string} str - The string to convert
 * @returns {string} The kebab-case version of the string
 */
const toKebabCase = (str) => {
	// Special handling for common acronyms
	const withReplacedAcronyms = str
		.replace(/ID/g, 'Id')
		.replace(/API/g, 'Api')
		.replace(/UI/g, 'Ui')
		.replace(/URL/g, 'Url')
		.replace(/URI/g, 'Uri')
		.replace(/JSON/g, 'Json')
		.replace(/XML/g, 'Xml')
		.replace(/HTML/g, 'Html')
		.replace(/CSS/g, 'Css');

	// Insert hyphens before capital letters and convert to lowercase
	return withReplacedAcronyms
		.replace(/([A-Z])/g, '-$1')
		.toLowerCase()
		.replace(/^-/, ''); // Remove leading hyphen if present
};

/**
 * Detect camelCase flags in command arguments
 * @param {string[]} args - Command line arguments to check
 * @returns {Array<{original: string, kebabCase: string}>} - List of flags that should be converted
 */
function detectCamelCaseFlags(args) {
	const camelCaseFlags = [];
	for (const arg of args) {
		if (arg.startsWith('--')) {
			const flagName = arg.split('=')[0].slice(2); // Remove -- and anything after =

			// Skip single-word flags - they can't be camelCase
			if (!flagName.includes('-') && !/[A-Z]/.test(flagName)) {
				continue;
			}

			// Check for camelCase pattern (lowercase followed by uppercase)
			if (/[a-z][A-Z]/.test(flagName)) {
				const kebabVersion = toKebabCase(flagName);
				if (kebabVersion !== flagName) {
					camelCaseFlags.push({
						original: flagName,
						kebabCase: kebabVersion
					});
				}
			}
		}
	}
	return camelCaseFlags;
}

export {
	toKebabCase,
	detectCamelCaseFlags
}; 