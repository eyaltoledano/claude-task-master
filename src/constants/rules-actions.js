/**
 * @typedef {'add' | 'remove'} RulesAction
 */

/**
 * Individual rules action constants
 */
export const RULES_ACTIONS = {
	ADD: 'add',
	REMOVE: 'remove'
};

/**
 * Special rules command (not a CRUD operation)
 */
export const RULES_SETUP_ACTION = 'setup';

/**
 * Check if a given action is a valid rules action
 * @param {string} action - The action to check
 * @returns {boolean} True if the action is valid, false otherwise
 */
export function isValidRulesAction(action) {
	return Object.values(RULES_ACTIONS).includes(action);
}
