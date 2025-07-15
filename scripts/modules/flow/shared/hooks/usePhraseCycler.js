import { useState, useEffect, useRef } from 'react';

/**
 * Hook for cycling through phrases/messages at specified intervals
 * Based on Gemini CLI's usePhraseCycler implementation
 *
 * @param {string|Array} phrases - Array of phrases or collection name
 * @param {Object} options - Configuration options
 */
export function usePhraseCycler(phrases = [], options = {}) {
	// If phrases is a string, look it up in collections
	const actualPhrases =
		typeof phrases === 'string' ? PhraseCollections[phrases] || [] : phrases;
	const {
		interval = 2000,
		startIndex = 0,
		paused = false,
		randomize = false
	} = options;

	const [currentIndex, setCurrentIndex] = useState(startIndex);
	const [currentPhrase, setCurrentPhrase] = useState(
		actualPhrases[startIndex] || ''
	);
	const intervalRef = useRef(null);
	const phrasesRef = useRef(actualPhrases);

	// Update phrases ref when phrases change
	phrasesRef.current = actualPhrases;

	useEffect(() => {
		if (paused || actualPhrases.length <= 1) {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			return;
		}

		intervalRef.current = setInterval(() => {
			setCurrentIndex((prevIndex) => {
				const nextIndex = randomize
					? Math.floor(Math.random() * phrasesRef.current.length)
					: (prevIndex + 1) % phrasesRef.current.length;

				setCurrentPhrase(phrasesRef.current[nextIndex] || '');
				return nextIndex;
			});
		}, interval);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [interval, paused, randomize, actualPhrases.length]);

	// Update current phrase when phrases or index changes
	useEffect(() => {
		setCurrentPhrase(actualPhrases[currentIndex] || '');
	}, [actualPhrases, currentIndex]);

	return {
		currentPhrase,
		currentIndex,
		totalPhrases: actualPhrases.length,
		setIndex: (index) => {
			if (index >= 0 && index < actualPhrases.length) {
				setCurrentIndex(index);
				setCurrentPhrase(actualPhrases[index]);
			}
		},
		next: () => {
			const nextIndex = (currentIndex + 1) % actualPhrases.length;
			setCurrentIndex(nextIndex);
			setCurrentPhrase(actualPhrases[nextIndex]);
		},
		reset: () => {
			setCurrentIndex(startIndex);
			setCurrentPhrase(actualPhrases[startIndex] || '');
		}
	};
}

/**
 * Predefined phrase collections for common use cases
 */
export const PhraseCollections = {
	loading: [
		'Loading tasks...',
		'Fetching data...',
		'Please wait...',
		'Working on it...',
		'Almost there...',
		'Processing...'
	],

	thinking: [
		'Thinking...',
		'Analyzing...',
		'Computing...',
		'Processing...',
		'Working...'
	],

	searching: [
		'Searching...',
		'Looking for matches...',
		'Scanning files...',
		'Finding results...',
		'Indexing content...'
	],

	connecting: [
		'Connecting...',
		'Establishing connection...',
		'Reaching out...',
		'Linking up...',
		'Syncing...'
	],

	ai: [
		'AI is thinking...',
		'Generating subtasks...',
		'Analyzing complexity...',
		'Processing request...',
		'Crafting response...',
		'Almost ready...'
	],

	git: [
		'Checking git status...',
		'Creating worktree...',
		'Switching branches...',
		'Updating repository...',
		'Fetching changes...'
	],

	claude: [
		'Launching Claude Code...',
		'Preparing context...',
		'Starting session...',
		'Opening workspace...',
		'Initializing environment...'
	],

	claudeProcessing: [
		'Claude is thinking...',
		'Processing your request...',
		'Analyzing code context...',
		'Generating response...',
		'Executing tools...',
		'Reading project files...',
		'Writing implementation...',
		'Running diagnostics...',
		'Almost ready...'
	]
};
