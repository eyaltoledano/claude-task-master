import type React from 'react';
import { useState } from 'react';
import { Button } from './button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CollapsibleSectionProps {
	title: string;
	icon?: LucideIcon;
	defaultExpanded?: boolean;
	className?: string;
	headerClassName?: string;
	contentClassName?: string;
	buttonClassName?: string;
	children: React.ReactNode;
	rightElement?: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
	title,
	icon: Icon,
	defaultExpanded = false,
	className = '',
	headerClassName = '',
	contentClassName = '',
	buttonClassName = 'text-vscode-foreground/70 hover:text-vscode-foreground',
	children,
	rightElement
}) => {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	return (
		<div className={`mb-8 ${className}`}>
			<div className={`flex items-center gap-2 mb-4 ${headerClassName}`}>
				<Button
					variant="ghost"
					size="sm"
					className={`p-0 h-auto ${buttonClassName}`}
					onClick={() => setIsExpanded(!isExpanded)}
				>
					{isExpanded ? (
						<ChevronDown className="w-4 h-4 mr-1" />
					) : (
						<ChevronRight className="w-4 h-4 mr-1" />
					)}
					{Icon && <Icon className="w-4 h-4 mr-1" />}
					{title}
				</Button>
				{rightElement}
			</div>

			{isExpanded && (
				<div
					className={`bg-widget-background rounded-lg p-4 border border-widget-border ${contentClassName}`}
				>
					{children}
				</div>
			)}
		</div>
	);
};
