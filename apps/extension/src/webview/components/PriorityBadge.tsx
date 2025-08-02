/**
 * Priority Badge Component
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { TaskMasterTask } from '../types';

interface PriorityBadgeProps {
	priority: TaskMasterTask['priority'];
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
	if (!priority) return null;

	const variants = {
		high: 'destructive' as const,
		medium: 'default' as const,
		low: 'secondary' as const
	};

	return (
		<Badge
			variant={variants[priority] || 'secondary'}
			className="text-xs font-normal px-2 py-0.5"
		>
			{priority}
		</Badge>
	);
};
