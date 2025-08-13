/**
 * Test utilities for state refactor tests
 */

import { act } from '@testing-library/react';
import { useUIStore } from '../stores/ui-store.js';
import { useDataStore } from '../stores/data-store.js';
import { usePreferencesStore } from '../stores/preferences-store.js';
import { useNavigationStore } from '../stores/navigation-store.js';

export const testUtils = {
	resetAllStores: () => {
		useUIStore.getState().resetUIState();
		useDataStore.getState().resetTaskData();
		useDataStore.getState().resetGitData();
		usePreferencesStore.getState().resetToDefaults();
		useNavigationStore.getState().resetNavigation();
	},

	createMockTasks: (count = 5) => {
		return Array.from({ length: count }, (_, i) => ({
			id: `${i + 1}`,
			title: `Test Task ${i + 1}`,
			description: `Description for task ${i + 1}`,
			status: i % 2 === 0 ? 'pending' : 'done',
			priority: ['high', 'medium', 'low'][i % 3],
			createdAt: new Date().toISOString()
		}));
	},

	simulateUserFlow: (steps) => {
		return steps.map((step) => act(() => step()));
	}
};
