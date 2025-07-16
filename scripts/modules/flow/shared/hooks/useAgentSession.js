// useAgentSession.js - Shared hook for managing agent sessions

import { useState, useEffect, useRef, useCallback } from 'react';
import { UnifiedAgentService } from '../services/UnifiedAgentService.js';

export function useAgentSession(
	backend,
	taskId = null,
	initialAgent = 'claude'
) {
	const [sessions, setSessions] = useState([]);
	const [activeSession, setActiveSession] = useState(null);
	const [messages, setMessages] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const serviceRef = useRef(new UnifiedAgentService(backend));
	const abortControllerRef = useRef(null);

	useEffect(() => {
		const loadSessions = async () => {
			setLoading(true);
			try {
				const availableSessions =
					await serviceRef.current.getSessions(initialAgent); // Assuming service extension for getSessions
				setSessions(availableSessions);
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};
		loadSessions();

		return () => {
			if (abortControllerRef.current) abortControllerRef.current.abort();
		};
	}, [initialAgent]);

	const createNewSession = async () => {
		setLoading(true);
		try {
			const newSession = await serviceRef.current.createSession(
				initialAgent,
				taskId
			);
			setSessions((prev) => [...prev, newSession]);
			setActiveSession(newSession);
			return newSession;
		} catch (err) {
			setError(`Failed to create session: ${err.message}`);
			throw err;
		} finally {
			setLoading(false);
		}
	};

	const watchSession = useCallback(async (sessionId) => {
		try {
			abortControllerRef.current = new AbortController();
			const stream = await serviceRef.current.watchSession(sessionId);
			for await (const update of stream) {
				if (abortControllerRef.current.signal.aborted) break;
				setMessages((prev) => [...prev, update]);
			}
		} catch (err) {
			if (!abortControllerRef.current?.signal.aborted) {
				setError(`Session watch failed: ${err.message}`);
			}
		}
	}, []); // Empty deps assuming no external dependencies

	useEffect(() => {
		if (activeSession) {
			watchSession(activeSession.id);
		}
	}, [activeSession, watchSession]);

	return {
		sessions,
		activeSession,
		setActiveSession,
		messages,
		loading,
		error,
		createNewSession,
		watchSession
	};
}
