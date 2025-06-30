#!/usr/bin/env node

/**
 * Test script for the theme system
 * Run with: node scripts/modules/flow/tests/test-theme.js
 */

import {
	themeManager,
	style,
	gradient,
	getComponentTheme,
	ColorUtils,
	Gradients
} from '../theme.js';

console.log('\n🎨 Task Master Theme System Demo\n');

// 1. Theme Detection
const theme = themeManager.getTheme();
console.log(`Detected theme: ${theme.name} (${theme.type})`);
console.log(`Terminal: ${process.env.TERM_PROGRAM || 'Unknown'}\n`);

// 2. Gradient Text Demo
console.log(
	gradient('═══════════════════════════════════════', ['primary', 'secondary'])
);
console.log(
	gradient('  Task Master Flow - Theme System  ', ['primary', 'accent'])
);
console.log(
	gradient('═══════════════════════════════════════', ['secondary', 'primary'])
);
console.log();

// 3. Semantic Colors Demo
console.log('📝 Semantic Text Colors:');
console.log(style('  Primary text color', 'text.primary'));
console.log(style('  Secondary text color', 'text.secondary'));
console.log(style('  Tertiary text color', 'text.tertiary'));
console.log();

// 4. State Colors Demo
console.log('🚦 State Colors:');
console.log(style('  ✓ Success state', 'state.success.primary'));
console.log(style('  ✗ Error state', 'state.error.primary'));
console.log(style('  ⚠ Warning state', 'state.warning.primary'));
console.log(style('  ℹ Info state', 'state.info.primary'));
console.log();

// 5. Component Theming Demo
console.log('🧩 Component Themes:');
const taskTheme = getComponentTheme('taskList');
console.log('  Task List Status Colors:');
console.log(style('    ✓ Done', taskTheme.status.done));
console.log(style('    ⏳ In Progress', taskTheme.status['in-progress']));
console.log(style('    ⏸ Pending', taskTheme.status.pending));
console.log(style('    🚫 Blocked', taskTheme.status.blocked));
console.log();

// 6. Color Utilities Demo
console.log('🔧 Color Utilities:');
const baseColor = '#0ea5e9';
console.log(`  Base color: ${style('████', baseColor)}`);
console.log(
	`  20% lighter: ${style('████', ColorUtils.adjustBrightness(baseColor, 20))}`
);
console.log(
	`  20% darker: ${style('████', ColorUtils.adjustBrightness(baseColor, -20))}`
);
console.log();

// 7. Multi-color Gradients
console.log('🌈 Advanced Gradients:');
const rainbowColors = [
	'#ff0000',
	'#ff7f00',
	'#ffff00',
	'#00ff00',
	'#0000ff',
	'#8b00ff'
];
const rainbowGradient = Gradients.create(
	rainbowColors[0],
	rainbowColors[5],
	40
);
console.log(
	Gradients.applyToText(
		'  Rainbow gradient text effect!          ',
		rainbowGradient
	)
);
console.log();

// 8. Theme Override Demo
console.log('🔄 Theme Override:');
console.log(`  Current: ${themeManager.getTheme().name}`);

// Try light theme
themeManager.setTheme('light');
console.log(`  Forced to: ${themeManager.getTheme().name}`);
console.log(style('    Sample text in light theme', 'text.primary'));

// Try dark theme
themeManager.setTheme('dark');
console.log(`  Forced to: ${themeManager.getTheme().name}`);
console.log(style('    Sample text in dark theme', 'text.primary'));

// Back to auto
themeManager.setTheme(null);
console.log(`  Back to auto: ${themeManager.getTheme().name}`);
console.log();

// 9. Complex Gradient Examples
console.log('✨ Complex Gradients:');
const complexGradient1 = gradient('Task Master: Next Generation CLI', [
	'primary',
	'secondary',
	'accent'
]);
console.log(`  ${complexGradient1}`);

const complexGradient2 = gradient('Building Better Developer Tools', [
	'state.success.primary',
	'state.info.primary'
]);
console.log(`  ${complexGradient2}`);
console.log();

// 10. Practical Example - Task Display
console.log('📋 Practical Example - Task Display:');
console.log(
	gradient('┌─────────────────────────────────────┐', [
		'border.primary',
		'border.focus'
	])
);
console.log(
	style('│ ', 'border.primary') +
		style('Task #42: ', 'text.secondary') +
		style('Implement Advanced Theme System', 'text.primary') +
		style(' │', 'border.primary')
);
console.log(
	style('│ ', 'border.primary') +
		style('Status: ', 'text.secondary') +
		style('In Progress', 'state.info.primary') +
		'                    ' +
		style('│', 'border.primary')
);
console.log(
	style('│ ', 'border.primary') +
		style('Priority: ', 'text.secondary') +
		style('High', 'state.error.primary') +
		'                          ' +
		style('│', 'border.primary')
);
console.log(
	gradient('└─────────────────────────────────────┘', [
		'border.focus',
		'border.primary'
	])
);
console.log();

// Color palette display
console.log('🎨 Current Theme Palette:');
const currentTheme = themeManager.getTheme();
console.log(
	`  Primary: ${style('████', 'primary')} ${themeManager.getColor('primary')}`
);
console.log(
	`  Secondary: ${style('████', 'secondary')} ${themeManager.getColor('secondary')}`
);
console.log(
	`  Tertiary: ${style('████', 'tertiary')} ${themeManager.getColor('tertiary')}`
);
console.log(
	`  Accent: ${style('████', 'accent')} ${themeManager.getColor('accent')}`
);
console.log();

console.log(
	gradient('═══════════════════════════════════════', ['primary', 'secondary'])
);
console.log('\n✅ Theme system test complete!\n');
