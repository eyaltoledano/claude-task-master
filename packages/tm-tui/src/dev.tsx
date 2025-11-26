#!/usr/bin/env node
/**
 * Development entry point for @tm/tui
 *
 * Run with: npx tsx src/dev.tsx
 * Flags:
 *   --api          Hamster mode (simulates connected state)
 *   --no-splash    Skip splash screen
 *   --authed       Simulate authenticated state
 */
import React from 'react';
import { render } from 'ink';
import Shell from './shell/Shell.js';

// Rich demo tasks
const demoTasks = [
	{
		id: 'TAS-60',
		title: 'CLI initialization with storage options',
		status: 'done' as const,
		priority: 'high' as const,
		dependencies: [],
		description: 'Users can choose between local Taskmaster storage and Hamster Studio cloud storage during initialization.',
		details: `Implementation involves modifying the init command to present storage options.
The flow should be:
1. Detect if already initialized
2. Present storage mode selection (Solo/Hamster)
3. If Hamster, trigger OAuth flow
4. Save preference to .taskmaster/config.json
5. Display success confirmation`,
		testStrategy: 'Verify both storage paths work correctly and config is persisted across sessions.',
		subtasks: [
			{ id: 'TAS-60.1', title: 'Add storage mode prompt to init flow', status: 'done' as const },
			{ id: 'TAS-60.2', title: 'Implement OAuth flow for Hamster auth', status: 'done' as const },
			{ id: 'TAS-60.3', title: 'Save storage preference to config', status: 'done' as const },
			{ id: 'TAS-60.4', title: 'Add mode indicator to CLI banner', status: 'done' as const },
		],
	},
	{
		id: 'TAS-61',
		title: 'Professional error messages',
		status: 'done' as const,
		priority: 'high' as const,
		dependencies: ['TAS-60'],
		description: 'Error messages are branded with Task Master styling and provide actionable guidance.',
		details: `Create a unified error display system:
- Boxed error messages with Task Master branding
- Actionable guidance for common issues
- Stack traces in verbose mode only
- Color-coded severity levels`,
		subtasks: [
			{ id: 'TAS-61.1', title: 'Create error display component', status: 'done' as const },
			{ id: 'TAS-61.2', title: 'Add actionable error messages', status: 'done' as const },
		],
	},
	{
		id: 'TAS-62',
		title: 'Brief context display in header',
		status: 'pending' as const,
		priority: 'high' as const,
		dependencies: ['TAS-60'],
		description: 'Show active brief in CLI header and support command shortcuts.',
		details: `When connected to a Hamster brief:
1. Show brief name/ID in the header
2. Support tm list / tm show shortcuts  
3. Display sync status indicator
4. Add brief URL for reference`,
		testStrategy: 'Connect to brief and verify header updates correctly with all info displayed.',
		subtasks: [
			{ id: 'TAS-62.1', title: 'Parse brief context from auth state', status: 'pending' as const },
			{ id: 'TAS-62.2', title: 'Update banner to show brief info', status: 'pending' as const },
			{ id: 'TAS-62.3', title: 'Add command aliases for brief mode', status: 'pending' as const },
		],
	},
	{
		id: 'TAS-63',
		title: 'Export tasks to Hamster',
		status: 'pending' as const,
		priority: 'high' as const,
		dependencies: ['TAS-60', 'TAS-61', 'TAS-62'],
		description: 'Sync local tasks to Hamster cloud storage with intelligent conflict resolution.',
		details: `Export command implementation:
- Read local tasks.json
- Transform to Hamster API format
- Handle conflicts intelligently
- Show progress during sync
- Support incremental updates`,
		subtasks: [
			{ id: 'TAS-63.1', title: 'Create export command', status: 'pending' as const },
			{ id: 'TAS-63.2', title: 'Implement task transformation', status: 'pending' as const },
			{ id: 'TAS-63.3', title: 'Add conflict resolution UI', status: 'pending' as const },
			{ id: 'TAS-63.4', title: 'Add sync progress indicator', status: 'pending' as const },
		],
	},
	{
		id: 'TAS-64',
		title: 'Usage analytics tracking',
		status: 'pending' as const,
		priority: 'medium' as const,
		dependencies: ['TAS-60'],
		description: 'Track CLI usage patterns to improve the product and user experience.',
		details: `Implement opt-in analytics:
- Track command usage frequencies
- Measure task completion rates
- Identify common error patterns
- All data anonymized and optional`,
		subtasks: [],
	},
	{
		id: 'TAS-65',
		title: 'Auto-detect storage mode',
		status: 'pending' as const,
		priority: 'low' as const,
		dependencies: ['TAS-64'],
		description: 'Infer storage mode from authentication state automatically.',
		subtasks: [],
	},
];

// Parse CLI args
const args = process.argv.slice(2);
const showSplash = !args.includes('--no-splash');
const isApi = args.includes('--api');
const isAuthed = args.includes('--authed') || isApi; // --api implies authed

// Check if stdin supports raw mode
const isInteractive = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';

// Clear screen
console.clear();

// Simulate auth state
const authState = isAuthed
	? {
			isAuthenticated: true,
			email: 'dev@tryhamster.com',
			userId: 'user_123',
	  }
	: {
			isAuthenticated: false,
	  };

// Render the shell
const instance = render(
	<Shell
		showSplash={showSplash && isInteractive}
		initialTag="master"
		storageType={isApi ? 'api' : 'local'}
		brief={isApi ? { id: 'BRIEF-001', name: 'Init & Post Auth UX Improvements' } : undefined}
		version="0.35.0"
		initialTasks={demoTasks}
		isInteractive={isInteractive}
		authState={authState}
		onExit={() => {
			instance.unmount();
			console.log('\n👋 Goodbye!\n');
			process.exit(0);
		}}
	/>
);

// In non-interactive mode, wait for render then exit
if (!isInteractive) {
	setTimeout(() => {
		instance.unmount();
		console.log('\n💡 Run in an interactive terminal (iTerm, Terminal.app) for full TUI.\n');
		process.exit(0);
	}, 300);
}
