import React, { memo, Suspense, lazy, useRef } from 'react';
import { Box, Text } from 'ink';
import { useLazyLoad } from '../../hooks/usePerformance.js';
import { LoadingSpinner } from '../../../features/ui/index.js';

/**
 * Lazy load container with intersection observer
 */
export const LazyLoadContainer = memo(({
  children,
  fallback = <LoadingSpinner />,
  threshold = 0.1,
  rootMargin = '50px',
  placeholder = <Box height={10} />
}) => {
  const containerRef = useRef();
  const { isIntersecting, hasLoaded } = useLazyLoad(containerRef, {
    threshold,
    rootMargin
  });

  return (
    <Box ref={containerRef}>
      {hasLoaded ? children : placeholder}
    </Box>
  );
});

LazyLoadContainer.displayName = 'LazyLoadContainer';

/**
 * Progressive image loader
 */
export const ProgressiveImage = memo(({
  src,
  placeholder,
  alt,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const img = new Image();
    
    img.onload = () => {
      setIsLoaded(true);
      if (onLoad) onLoad();
    };
    
    img.onerror = () => {
      setHasError(true);
      if (onError) onError();
    };
    
    img.src = src;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onLoad, onError]);

  if (hasError) {
    return <Text color="red">⚠️ Failed to load image</Text>;
  }

  if (!isLoaded) {
    return placeholder || <Text color="gray">Loading image...</Text>;
  }

  return <Text>{alt || 'Image loaded'}</Text>;
});

ProgressiveImage.displayName = 'ProgressiveImage';

/**
 * Skeleton loader component
 */
export const SkeletonLoader = memo(({
  width = 20,
  height = 1,
  animate = true
}) => {
  const [opacity, setOpacity] = React.useState(0.3);

  React.useEffect(() => {
    if (!animate) return;

    const interval = setInterval(() => {
      setOpacity(prev => prev === 0.3 ? 0.7 : 0.3);
    }, 1000);

    return () => clearInterval(interval);
  }, [animate]);

  const skeletonLine = '█'.repeat(width);

  return (
    <Box flexDirection="column">
      {Array.from({ length: height }).map((_, i) => (
        <Text key={`skeleton-${width}-${height}-line-${i}`} color="gray" dimColor opacity={opacity}>
          {skeletonLine}
        </Text>
      ))}
    </Box>
  );
});

SkeletonLoader.displayName = 'SkeletonLoader';

/**
 * Code splitting helper
 */
export const LazyComponent = ({ 
  loader, 
  fallback = <LoadingSpinner />,
  errorFallback = <Text color="red">Failed to load component</Text>
}) => {
  const Component = lazy(loader);

  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
};

/**
 * Simple error boundary for lazy components
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

/**
 * Batch loader for multiple items
 */
export const BatchLoader = memo(({
  items,
  batchSize = 10,
  renderItem,
  loadingMessage = 'Loading...',
  onBatchLoad
}) => {
  const [loadedCount, setLoadedCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  const loadNextBatch = React.useCallback(async () => {
    if (isLoading || loadedCount >= items.length) return;

    setIsLoading(true);
    
    // Simulate async loading
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const nextCount = Math.min(loadedCount + batchSize, items.length);
    const batch = items.slice(loadedCount, nextCount);
    
    if (onBatchLoad) {
      await onBatchLoad(batch);
    }
    
    setLoadedCount(nextCount);
    setIsLoading(false);
  }, [items, loadedCount, batchSize, isLoading, onBatchLoad]);

  React.useEffect(() => {
    if (loadedCount === 0) {
      loadNextBatch();
    }
  }, [loadedCount, loadNextBatch]);

  const loadedItems = items.slice(0, loadedCount);

  return (
    <Box flexDirection="column">
      {loadedItems.map((item, index) => (
        <Box key={item.id || index}>
          {renderItem(item, index)}
        </Box>
      ))}
      
      {loadedCount < items.length && (
        <Box flexDirection="column" marginTop={1}>
          {isLoading ? (
            <Text color="yellow">{loadingMessage}</Text>
          ) : (
            <Text color="cyan" onClick={loadNextBatch}>
              Load more ({items.length - loadedCount} remaining)
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
});

BatchLoader.displayName = 'BatchLoader'; 