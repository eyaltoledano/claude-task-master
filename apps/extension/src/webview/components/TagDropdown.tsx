import React, { useState, useEffect, useRef } from 'react';

interface TagDropdownProps {
	currentTag: string;
	availableTags: string[];
	onTagSwitch: (tagName: string) => Promise<void>;
	sendMessage: (message: any) => Promise<any>;
	dispatch: React.Dispatch<any>;
}

export const TagDropdown: React.FC<TagDropdownProps> = ({
	currentTag,
	availableTags,
	onTagSwitch,
	sendMessage,
	dispatch
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Fetch tags when component mounts
	useEffect(() => {
		fetchTags();
	}, []);

	// Handle click outside to close dropdown
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
	}, [isOpen]);

	const fetchTags = async () => {
		try {
			const result = await sendMessage({ type: 'getTags' });

			if (result?.tags && result?.currentTag) {
				const tagNames = result.tags.map((tag: any) => tag.name || tag);
				dispatch({
					type: 'SET_TAG_DATA',
					payload: {
						currentTag: result.currentTag,
						availableTags: tagNames
					}
				});
			}
		} catch (error) {
			console.error('Failed to fetch tags:', error);
		}
	};

	const handleTagSwitch = async (tagName: string) => {
		if (tagName === currentTag) {
			setIsOpen(false);
			return;
		}

		setIsLoading(true);
		try {
			await onTagSwitch(tagName);
			dispatch({ type: 'SET_CURRENT_TAG', payload: tagName });
			setIsOpen(false);
		} catch (error) {
			console.error('Failed to switch tag:', error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				disabled={isLoading}
				className="flex items-center gap-2 px-3 py-1.5 text-sm bg-vscode-dropdown-background text-vscode-dropdown-foreground border border-vscode-dropdown-border rounded hover:bg-vscode-list-hoverBackground transition-colors"
			>
				<span className="font-medium">{currentTag}</span>
				<svg
					className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>

			{isOpen && (
				<div className="absolute top-full mt-1 right-0 bg-background border border-vscode-dropdown-border rounded shadow-lg z-50 min-w-[200px] py-1">
					{availableTags.map((tag) => (
						<button
							key={tag}
							onClick={() => handleTagSwitch(tag)}
							className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between group
								${
									tag === currentTag
										? 'bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground'
										: 'hover:bg-vscode-list-hoverBackground text-vscode-dropdown-foreground'
								}`}
						>
							<span className="truncate pr-2">{tag}</span>
							{tag === currentTag && (
								<svg
									className="w-4 h-4 flex-shrink-0 text-vscode-textLink-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
};
