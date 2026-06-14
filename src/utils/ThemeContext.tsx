import { createContext, useContext, type ReactNode } from 'react';
import type { SoftTheme } from '../types';

/**
 * ThemeContext - Provides theme data to all components without prop drilling
 *
 * Usage:
 * 1. Wrap your app with <ThemeProvider theme={themeObject}>
 * 2. In any component: const theme = useTheme();
 */

const ThemeContext = createContext<SoftTheme | null>(null);

/**
 * ThemeProvider component - wraps the app and provides theme to all children
 */
export function ThemeProvider({
    theme,
    children,
}: {
    theme: SoftTheme;
    children: ReactNode;
}) {
    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * useTheme hook - access the current theme from any component
 * @throws {Error} If used outside of ThemeProvider
 */
export function useTheme(): SoftTheme {
    const theme = useContext(ThemeContext);
    if (!theme) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return theme;
}

export default ThemeContext;
