import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export function CommandSuggestions({ suggestions, selectedIndex }) {
  if (suggestions.length === 0) {
    return null;
  }
  
  return (
    <Box 
      flexDirection="column" 
      marginLeft={0}
      marginBottom={0}
      paddingLeft={0}
      paddingRight={1}
    >
      {suggestions.map((suggestion, index) => {
        const isSelected = index === selectedIndex;
        
        return (
          <Box 
            key={suggestion.name} 
            paddingLeft={0} 
            paddingRight={2}
          >
            <Text color={isSelected ? 'cyan' : '#666666'}>
              {isSelected ? '❯ ' : '  '}
            </Text>
            <Box minWidth={12}>
              <Text color={isSelected ? 'white' : '#999999'} bold={isSelected}>
                {suggestion.name}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text color={isSelected ? '#cccccc' : '#666666'}>
                {suggestion.description}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
} 