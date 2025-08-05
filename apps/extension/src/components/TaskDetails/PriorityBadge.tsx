import type React from 'react';
import type { TaskMasterTask } from '../../webview/types';

// Custom Priority Badge Component with theme-adaptive styling
export const PriorityBadge: React.FC<{
	priority: TaskMasterTask['priority'];
}> = ({ priority }) => {
	const getPriorityColors = (priority: string) => {
		switch (priority) {
			case 'high':
				return {
					backgroundColor: 'rgba(239, 68, 68, 0.2)', // red-500 with opacity
					color: '#dc2626', // red-600 - works in both themes
					borderColor: 'rgba(239, 68, 68, 0.4)'
				};
			case 'medium':
				return {
					backgroundColor: 'rgba(245, 158, 11, 0.2)', // amber-500 with opacity
					color: '#d97706', // amber-600 - works in both themes
					borderColor: 'rgba(245, 158, 11, 0.4)'
				};
			case 'low':
				return {
					backgroundColor: 'rgba(34, 197, 94, 0.2)', // green-500 with opacity
					color: '#16a34a', // green-600 - works in both themes
					borderColor: 'rgba(34, 197, 94, 0.4)'
				};
			default:
				return {
					backgroundColor: 'rgba(156, 163, 175, 0.2)',
					color: 'var(--vscode-foreground)',
					borderColor: 'rgba(156, 163, 175, 0.4)'
				};
		}
	};

	const colors = getPriorityColors(priority || '');

	return (
		<span
			className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border"
			style={colors}
		>
			{priority || 'None'}
		</span>
	);
};
