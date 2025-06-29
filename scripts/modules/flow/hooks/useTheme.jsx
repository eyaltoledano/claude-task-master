import { useState, useEffect, useCallback, useContext, createContext, useMemo } from 'react';
import { themeManager, getTheme, setTheme, getColor, getComponentTheme } from '../theme.js';

/**
 * Theme Context for providing theme data throughout the app
 */
const ThemeContext = createContext();

/**
 * Theme Provider Component
 */
export function ThemeProvider({ children, initialTheme }) {
  const [currentTheme, setCurrentTheme] = useState(() => 
    initialTheme || getTheme()
  );
  const [isDarkMode, setIsDarkMode] = useState(
    () => currentTheme.type === 'dark'
  );

  const updateTheme = useCallback((themeName) => {
    const newTheme = setTheme(themeName);
    setCurrentTheme(newTheme);
    setIsDarkMode(newTheme.type === 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    const newThemeType = isDarkMode ? 'light' : 'dark';
    updateTheme(newThemeType);
  }, [isDarkMode, updateTheme]);

  const value = {
    theme: currentTheme,
    isDarkMode,
    isLightMode: !isDarkMode,
    updateTheme,
    toggleTheme,
    getColor: (path) => getColor(path),
    getComponentTheme: (component) => getComponentTheme(component),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook for accessing theme context
 * Based on Gemini CLI's theme hook patterns
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (!context) {
    // Fallback when used outside provider
    return {
      theme: getTheme(),
      isDarkMode: getTheme().type === 'dark',
      isLightMode: getTheme().type === 'light',
      updateTheme: setTheme,
      toggleTheme: () => {
        const current = getTheme();
        setTheme(current.type === 'dark' ? 'light' : 'dark');
      },
      getColor: (path) => getColor(path),
      getComponentTheme: (component) => getComponentTheme(component),
    };
  }
  
  return context;
}

/**
 * Hook for responsive theming based on terminal size
 */
export function useResponsiveTheme(breakpoints = {}) {
  const { theme, ...themeUtils } = useTheme();
  const [responsiveTheme, setResponsiveTheme] = useState(theme);

  const defaultBreakpoints = useMemo(() => ({
    narrow: 60,
    medium: 100,
    wide: 120,
    ...breakpoints,
  }), [breakpoints]);

  useEffect(() => {
    const updateResponsiveTheme = () => {
      const width = process.stdout.columns || 80;
      
      let responsiveOverrides = {};
      
      if (width < defaultBreakpoints.narrow) {
        // Narrow terminal adjustments
        responsiveOverrides = {
          spacing: {
            ...theme.spacing,
            padding: Math.max(1, theme.spacing?.padding - 1),
            margin: Math.max(1, theme.spacing?.margin - 1),
          },
          typography: {
            ...theme.typography,
            compact: true,
          },
        };
      } else if (width >= defaultBreakpoints.wide) {
        // Wide terminal enhancements
        responsiveOverrides = {
          spacing: {
            ...theme.spacing,
            padding: (theme.spacing?.padding || 2) + 1,
            margin: (theme.spacing?.margin || 1) + 1,
          },
          typography: {
            ...theme.typography,
            enhanced: true,
          },
        };
      }

      setResponsiveTheme({
        ...theme,
        ...responsiveOverrides,
      });
    };

    updateResponsiveTheme();
    
    // Listen for terminal resize
    process.stdout.on('resize', updateResponsiveTheme);
    
    return () => {
      process.stdout.off('resize', updateResponsiveTheme);
    };
  }, [theme, defaultBreakpoints]);

  return {
    theme: responsiveTheme,
    originalTheme: theme,
    ...themeUtils,
  };
}

/**
 * Hook for component-specific theming
 */
export function useComponentTheme(componentName, overrides = {}) {
  const { theme, getComponentTheme } = useTheme();
  
  const componentTheme = getComponentTheme(componentName);
  
  const resolvedTheme = useMemo(() => ({
    ...componentTheme,
    ...overrides,
  }), [componentTheme, overrides]);

  const getThemedProps = useCallback((props = {}) => {
    const themedProps = { ...props };
    
    // Apply theme colors to common props
    if (resolvedTheme.text && !props.color) {
      themedProps.color = getColor(resolvedTheme.text);
    }
    
    if (resolvedTheme.background && !props.backgroundColor) {
      themedProps.backgroundColor = getColor(resolvedTheme.background);
    }
    
    return themedProps;
  }, [resolvedTheme]);

  return {
    theme: resolvedTheme,
    getThemedProps,
    colors: theme.colors,
  };
}

/**
 * Hook for theme-aware styling
 */
export function useThemedStyles() {
  const { theme, getColor } = useTheme();

  const createStyle = useCallback((styleConfig) => {
    const resolvedStyle = {};
    
    Object.entries(styleConfig).forEach(([key, value]) => {
      if (typeof value === 'string' && value.includes('.')) {
        // Resolve color path
        resolvedStyle[key] = getColor(value);
      } else {
        resolvedStyle[key] = value;
      }
    });
    
    return resolvedStyle;
  }, [getColor]);

  const createConditionalStyle = useCallback((condition, trueStyle, falseStyle = {}) => {
    return createStyle(condition ? trueStyle : falseStyle);
  }, [createStyle]);

  const createVariantStyles = useCallback((variants) => {
    const resolvedVariants = {};
    
    Object.entries(variants).forEach(([variant, style]) => {
      resolvedVariants[variant] = createStyle(style);
    });
    
    return resolvedVariants;
  }, [createStyle]);

  return {
    createStyle,
    createConditionalStyle,
    createVariantStyles,
    theme,
  };
}

/**
 * Hook for theme transitions and animations
 */
export function useThemeTransitions() {
  const { theme, isDarkMode } = useTheme();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const withTransition = useCallback(async (callback, duration = 150) => {
    setIsTransitioning(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, duration / 2));
      await callback();
      await new Promise(resolve => setTimeout(resolve, duration / 2));
    } finally {
      setIsTransitioning(false);
    }
  }, []);

  return {
    isTransitioning,
    withTransition,
    transitionClass: isTransitioning ? 'theme-transitioning' : '',
  };
}

/**
 * Hook for theme persistence
 */
export function useThemePersistence() {
  const { theme, updateTheme } = useTheme();

  const saveTheme = useCallback((themeName) => {
    try {
      // Save to environment or config file
      process.env.TASKMASTER_THEME = themeName;
      updateTheme(themeName);
    } catch (error) {
      console.warn('Failed to persist theme:', error);
    }
  }, [updateTheme]);

  const loadTheme = useCallback(() => {
    try {
      const savedTheme = process.env.TASKMASTER_THEME;
      if (savedTheme) {
        updateTheme(savedTheme);
        return savedTheme;
      }
    } catch (error) {
      console.warn('Failed to load persisted theme:', error);
    }
    return null;
  }, [updateTheme]);

  return {
    saveTheme,
    loadTheme,
    currentTheme: theme.name,
  };
} 