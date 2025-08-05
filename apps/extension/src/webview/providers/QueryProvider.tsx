import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a stable query client
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Don't refetch on window focus by default
			refetchOnWindowFocus: false,
			// Keep data fresh for 30 seconds
			staleTime: 30 * 1000,
			// Cache data for 5 minutes
			gcTime: 5 * 60 * 1000,
			// Retry failed requests 3 times
			retry: 3,
			// Retry delay exponentially backs off
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
		},
		mutations: {
			// Don't retry mutations by default
			retry: false
		}
	}
});

interface QueryProviderProps {
	children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
};
