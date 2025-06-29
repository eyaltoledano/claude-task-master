import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import {
  useComponentTheme,
  useTerminalSize,
  useStateAndRef,
  useKeypress,
} from '../hooks/index.js';

export function ClaudeSessionList({
  sessions = [],
  selectedIndex,
  onSelectSession,
  onResumeSession,
  onViewSession,
  sessionFilter = 'all',
  onFilterChange,
  filterSubtaskId = null,
  highlightSessionId = null,
  scrollOffset = 0,
  visibleRows = 15,
}) {
  const { theme } = useComponentTheme('claudeSessionList');
  const { maxContentWidth, isNarrow } = useTerminalSize();
  
  // Performance optimization for large session lists
  const [filteredSessions, setFilteredSessions, filteredSessionsRef] = useStateAndRef([]);

  // Filter sessions based on current filter and subtask filter
  const applyFilters = useMemo(() => {
    const filtered = sessions.filter((session) => {
      // Apply subtask filter first
      if (filterSubtaskId && session.metadata?.subtaskId !== filterSubtaskId) {
        return false;
      }

      // Apply status filter
      if (sessionFilter === 'all') return true;
      if (sessionFilter === 'active') {
        return (
          !session.metadata?.finished ||
          (session.lastUpdated &&
            new Date(session.lastUpdated) > new Date(Date.now() - 3600000))
        );
      }
      if (sessionFilter === 'finished') {
        return session.metadata?.finished === true;
      }
      return true;
    });

    setFilteredSessions(filtered);
    return filtered;
  }, [sessions, sessionFilter, filterSubtaskId, setFilteredSessions]);

  // Keyboard handling for session list
  useKeypress({
    up: () => {
      if (selectedIndex > 0) {
        onSelectSession(selectedIndex - 1);
      }
    },
    down: () => {
      if (selectedIndex < filteredSessionsRef.current.length - 1) {
        onSelectSession(selectedIndex + 1);
      }
    },
    return: () => {
      const session = filteredSessionsRef.current[selectedIndex];
      if (session && onResumeSession) {
        onResumeSession(session.sessionId);
      }
    },
    'r': () => {
      const session = filteredSessionsRef.current[selectedIndex];
      if (session && onResumeSession) {
        onResumeSession(session.sessionId);
      }
    },
    'v': () => {
      const session = filteredSessionsRef.current[selectedIndex];
      if (session && onViewSession) {
        onViewSession(session);
      }
    },
    '1': () => onFilterChange('all'),
    '2': () => onFilterChange('active'),
    '3': () => onFilterChange('finished'),
  }, { isActive: filteredSessions.length > 0 });

  const renderFilterTabs = () => {
    const filters = [
      { key: 'all', label: 'All', count: sessions.length },
      { key: 'active', label: 'Active', count: sessions.filter(s => !s.metadata?.finished).length },
      { key: 'finished', label: 'Finished', count: sessions.filter(s => s.metadata?.finished).length },
    ];

    return (
      <Box flexDirection={isNarrow ? 'column' : 'row'} marginBottom={1}>
        {filters.map((filter, index) => {
          const isActive = sessionFilter === filter.key;
          return (
            <Box key={filter.key} marginRight={isNarrow ? 0 : 2}>
              <Text color={isActive ? theme.accent : theme.text.secondary}>
                [{index + 1}] {filter.label}
              </Text>
              {!isNarrow && (
                <Text color={theme.text.tertiary}>
                  {' '}({filter.count})
                </Text>
              )}
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderSessionItem = (session, index, isSelected) => {
    const isHighlighted = session.sessionId === highlightSessionId;
    const isFinished = session.metadata?.finished;
    const isSubtaskSession = session.metadata?.type === 'subtask-implementation';
    
    // Format timestamp
    const timestamp = session.lastUpdated 
      ? new Date(session.lastUpdated).toLocaleString()
      : 'Unknown';

    return (
      <Box 
        key={session.sessionId}
        flexDirection="column"
        paddingX={1}
        backgroundColor={isSelected ? theme.item.selected : 'transparent'}
        width={maxContentWidth}
      >
        {/* Session header */}
        <Box>
          <Text color={isSelected ? theme.accent : 'transparent'}>
            {isSelected ? '▶ ' : '  '}
          </Text>
          
          {/* Status indicator */}
          <Text color={isFinished ? 'green' : 'blue'}>
            {isFinished ? '✓' : '●'}
          </Text>
          
          {/* Session type indicator */}
          {isSubtaskSession && (
            <Text color="yellow"> 🔧</Text>
          )}
          
          {/* Session ID (truncated) */}
          <Text color={theme.text.secondary}>
            {' '}{session.sessionId?.slice(0, 8)}...
          </Text>
          
          {/* Timestamp */}
          {!isNarrow && (
            <Text color={theme.text.tertiary}>
              {' '}({new Date(timestamp).toLocaleDateString()})
            </Text>
          )}
          
          {/* Highlight indicator */}
          {isHighlighted && (
            <Text color={theme.accent} bold>
              {' '}★
            </Text>
          )}
        </Box>

        {/* Session details */}
        <Box paddingLeft={4}>
          {/* Subtask info for subtask sessions */}
          {isSubtaskSession && session.metadata?.subtaskId && (
            <Text color={theme.text.secondary}>
              Subtask: {session.metadata.subtaskId}
            </Text>
          )}
          
          {/* Prompt preview */}
          {session.prompt && (
            <Text color={theme.text.primary}>
              {session.prompt.length > 80 
                ? `${session.prompt.substring(0, 80)}...`
                : session.prompt}
            </Text>
          )}
        </Box>
      </Box>
    );
  };

  const renderEmptyState = () => {
    if (sessions.length === 0) {
      return (
        <Box justifyContent="center" paddingY={2}>
          <Text color={theme.text.secondary}>
            No Claude Code sessions found
          </Text>
        </Box>
      );
    }

    if (filteredSessions.length === 0) {
      return (
        <Box justifyContent="center" paddingY={2}>
          <Text color={theme.text.secondary}>
            No sessions match current filter
          </Text>
        </Box>
      );
    }

    return null;
  };

  const renderActions = () => {
    if (filteredSessions.length === 0) return null;

    return (
      <Box marginTop={1} paddingX={1}>
        <Text color={theme.text.secondary}>
          [Enter/r] Resume • [v] View • [1-3] Filter
        </Text>
      </Box>
    );
  };

  const visibleSessions = filteredSessions.slice(
    scrollOffset,
    scrollOffset + visibleRows
  );

  return (
    <Box flexDirection="column" width={maxContentWidth}>
      {/* Filter tabs */}
      {renderFilterTabs()}

      {/* Sessions list */}
      {renderEmptyState() || (
        <Box flexDirection="column">
          {visibleSessions.map((session, index) => {
            const actualIndex = scrollOffset + index;
            const isSelected = actualIndex === selectedIndex;
            return renderSessionItem(session, actualIndex, isSelected);
          })}
        </Box>
      )}

      {/* Scroll indicators */}
      {filteredSessions.length > visibleRows && (
        <Box justifyContent="center" marginTop={1}>
          <Text color={theme.text.tertiary}>
            Showing {Math.min(scrollOffset + visibleRows, filteredSessions.length)} of {filteredSessions.length} sessions
          </Text>
        </Box>
      )}

      {/* Action hints */}
      {renderActions()}
    </Box>
  );
} 