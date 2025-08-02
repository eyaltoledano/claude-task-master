'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
	DndContext,
	DragOverlay,
	MouseSensor,
	TouchSensor,
	rectIntersection,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import type React from 'react';
import type { ReactNode } from 'react';

export type { DragEndEvent } from '@dnd-kit/core';

export type Status = {
	id: string;
	name: string;
	color: string;
};

export type Feature = {
	id: string;
	name: string;
	startAt: Date;
	endAt: Date;
	status: Status;
};

export type KanbanBoardProps = {
	id: Status['id'];
	children: ReactNode;
	className?: string;
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
	const { isOver, setNodeRef } = useDroppable({ id });

	return (
		<div
			className={cn(
				'flex h-full min-h-40 flex-col gap-2 rounded-md border bg-secondary p-2 text-xs shadow-sm outline transition-all',
				isOver ? 'outline-primary' : 'outline-transparent',
				className
			)}
			ref={setNodeRef}
		>
			{children}
		</div>
	);
};

export type KanbanCardProps = Pick<Feature, 'id' | 'name'> & {
	index: number;
	parent: string;
	children?: ReactNode;
	className?: string;
	onClick?: (event: React.MouseEvent) => void;
	onDoubleClick?: (event: React.MouseEvent) => void;
};

export const KanbanCard = ({
	id,
	name,
	index,
	parent,
	children,
	className,
	onClick,
	onDoubleClick
}: KanbanCardProps) => {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			id,
			data: { index, parent }
		});

	return (
		<Card
			className={cn(
				'rounded-md p-3 shadow-sm',
				isDragging && 'cursor-grabbing opacity-0',
				!isDragging && 'cursor-pointer',
				className
			)}
			style={{
				transform: transform
					? `translateX(${transform.x}px) translateY(${transform.y}px)`
					: 'none'
			}}
			{...attributes}
			{...listeners}
			onClick={(e) => !isDragging && onClick?.(e)}
			onDoubleClick={onDoubleClick}
			ref={setNodeRef}
		>
			{children ?? <p className="m-0 font-medium text-sm">{name}</p>}
		</Card>
	);
};

export type KanbanCardsProps = {
	children: ReactNode;
	className?: string;
};

export const KanbanCards = ({ children, className }: KanbanCardsProps) => (
	<div className={cn('flex flex-1 flex-col gap-2', className)}>{children}</div>
);

export type KanbanHeaderProps =
	| {
			children: ReactNode;
	  }
	| {
			name: Status['name'];
			color: Status['color'];
			className?: string;
	  };

export const KanbanHeader = (props: KanbanHeaderProps) =>
	'children' in props ? (
		props.children
	) : (
		<div className={cn('flex shrink-0 items-center gap-2', props.className)}>
			<div
				className="h-2 w-2 rounded-full"
				style={{ backgroundColor: props.color }}
			/>
			<p className="m-0 font-semibold text-sm">{props.name}</p>
		</div>
	);

export type KanbanProviderProps = {
	children: ReactNode;
	onDragEnd: (event: DragEndEvent) => void;
	onDragStart?: (event: DragEndEvent) => void;
	onDragCancel?: () => void;
	className?: string;
	dragOverlay?: ReactNode;
};

export const KanbanProvider = ({
	children,
	onDragEnd,
	onDragStart,
	onDragCancel,
	className,
	dragOverlay
}: KanbanProviderProps) => {
	// Configure sensors with activation constraints to prevent accidental drags
	const sensors = useSensors(
		// Only start a drag if you've moved more than 8px
		useSensor(MouseSensor, {
			activationConstraint: { distance: 8 }
		}),
		// On touch devices, require a short press + small move
		useSensor(TouchSensor, {
			activationConstraint: { delay: 150, tolerance: 5 }
		})
	);

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={rectIntersection}
			onDragEnd={onDragEnd}
			onDragStart={onDragStart}
			onDragCancel={onDragCancel}
		>
			<div
				className={cn(
					'grid w-full auto-cols-fr grid-flow-col gap-4',
					className
				)}
			>
				{children}
			</div>
			<DragOverlay>{dragOverlay}</DragOverlay>
		</DndContext>
	);
};
