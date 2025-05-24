/**
 * @typedef {'cursor' | 'roo' | 'windsurf' | 'cline'} BrandRule
 */

/**
 * Available brand rules for project initialization
 * 
 * @type {BrandRule[]}
 * @description Defines possible brand rule sets:
 * - cursor: Cursor IDE rules (default)
 * - roo: Roo Code IDE rules
 * - windsurf: Windsurf IDE rules  
 * - cline: Cline IDE rules
 * 
 * To add a new brand:
 * 1. Add the brand name to this array
 * 2. Create a profile file in scripts/profiles/{brand}.js
 * 3. Export it in scripts/profiles/index.js
 * 4. Add it to BRAND_PROFILES in src/utils/rule-transformer.js
 */
export const BRAND_RULE_OPTIONS = [
	'cursor',
	'roo',
	'windsurf',
	'cline'
];

/**
 * Check if a given brand rule is valid
 * @param {string} brandRule - The brand rule to check
 * @returns {boolean} True if the brand rule is valid, false otherwise
 */
export function isValidBrandRule(brandRule) {
	return BRAND_RULE_OPTIONS.includes(brandRule);
} 