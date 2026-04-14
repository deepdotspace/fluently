import React from 'react';

/**
 * ThemeContext - Provides theme data to all components without prop drilling
 * 
 * Usage:
 * 1. Wrap your app with <ThemeProvider theme={themeObject}>
 * 2. In any component: const theme = useTheme();
 */

const ThemeContext = React.createContext(null);

/**
 * ThemeProvider component - wraps the app and provides theme to all children
 * @param {Object} props.theme - The theme object containing colors, styles, etc.
 * @param {React.ReactNode} props.children - Child components
 */
export function ThemeProvider({ theme, children }) {
    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * useTheme hook - access the current theme from any component
 * @returns {Object} The current theme object
 * @throws {Error} If used outside of ThemeProvider
 */
export function useTheme() {
    const theme = React.useContext(ThemeContext);
    if (!theme) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return theme;
}

export default ThemeContext;
