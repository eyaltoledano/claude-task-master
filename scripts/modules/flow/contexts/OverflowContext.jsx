import React, { createContext, useContext, useState, useCallback } from 'react';

// Create the overflow context
const OverflowContext = createContext();

/**
 * OverflowProvider - Provides overflow state management to the entire app
 * 
 * State structure:
 * {
 *   'component-id': {
 *     isOverflowing: boolean,
 *     isExpanded: boolean,
 *     maxLines: number,
 *     totalLines: number
 *   }
 * }
 */
export function OverflowProvider({ children }) {
	const [overflowState, setOverflowState] = useState(new Map());

	// Register a component with the overflow system
	const registerComponent = useCallback((id, config = {}) => {
		setOverflowState(prev => {
			const newState = new Map(prev);
			newState.set(id, {
				isOverflowing: false,
				isExpanded: false,
				maxLines: config.maxLines || 10,
				totalLines: 0,
				...config
			});
			return newState;
		});
	}, []);

	// Unregister a component from the overflow system
	const unregisterComponent = useCallback((id) => {
		setOverflowState(prev => {
			const newState = new Map(prev);
			newState.delete(id);
			return newState;
		});
	}, []);

	// Update overflow state for a specific component
	const updateOverflowState = useCallback((id, updates) => {
		setOverflowState(prev => {
			const newState = new Map(prev);
			const current = newState.get(id) || {};
			newState.set(id, { ...current, ...updates });
			return newState;
		});
	}, []);

	// Toggle expanded state for a component
	const toggleExpanded = useCallback((id) => {
		setOverflowState(prev => {
			const newState = new Map(prev);
			const current = newState.get(id) || {};
			newState.set(id, { 
				...current, 
				isExpanded: !current.isExpanded 
			});
			return newState;
		});
	}, []);

	// Get overflow state for a specific component
	const getOverflowState = useCallback((id) => {
		return overflowState.get(id) || {
			isOverflowing: false,
			isExpanded: false,
			maxLines: 10,
			totalLines: 0
		};
	}, [overflowState]);

	// Check if any component is currently overflowing
	const hasOverflowingContent = useCallback(() => {
		for (const [id, state] of overflowState) {
			if (state.isOverflowing && !state.isExpanded) {
				return true;
			}
		}
		return false;
	}, [overflowState]);

	// Get count of overflowing components
	const getOverflowCount = useCallback(() => {
		let count = 0;
		for (const [id, state] of overflowState) {
			if (state.isOverflowing && !state.isExpanded) {
				count++;
			}
		}
		return count;
	}, [overflowState]);

	const contextValue = {
		registerComponent,
		unregisterComponent,
		updateOverflowState,
		toggleExpanded,
		getOverflowState,
		hasOverflowingContent,
		getOverflowCount,
		overflowState
	};

	return (
		<OverflowContext.Provider value={contextValue}>
			{children}
		</OverflowContext.Provider>
	);
}

/**
 * useOverflow - Hook to access overflow context
 * 
 * @returns {Object} Overflow context methods and state
 */
export function useOverflow() {
	const context = useContext(OverflowContext);
	if (!context) {
		throw new Error('useOverflow must be used within an OverflowProvider');
	}
	return context;
}

// Export the context for advanced usage
export { OverflowContext }; 