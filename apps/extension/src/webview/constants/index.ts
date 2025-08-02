/**
 * Application constants
 */

import type { Status } from '@/components/ui/shadcn-io/kanban';

export const kanbanStatuses = [
	{
		id: 'pending',
		title: 'Pending',
		color: 'yellow',
		className: 'text-yellow-600 border-yellow-600/20'
	},
	{
		id: 'in-progress',
		title: 'In Progress',
		color: 'blue',
		className: 'text-blue-600 border-blue-600/20'
	},
	{
		id: 'review',
		title: 'Review',
		color: 'purple',
		className: 'text-purple-600 border-purple-600/20'
	},
	{
		id: 'done',
		title: 'Done',
		color: 'green',
		className: 'text-green-600 border-green-600/20'
	},
	{
		id: 'deferred',
		title: 'Deferred',
		color: 'gray',
		className: 'text-gray-600 border-gray-600/20'
	}
] as const;

export const CACHE_DURATION = 30000; // 30 seconds
export const REQUEST_TIMEOUT = 30000; // 30 seconds
export const HEADER_HEIGHT = 73; // Header with padding and border
